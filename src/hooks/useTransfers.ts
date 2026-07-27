import { useCallback } from 'react';
import { db } from '@/db';
import { transfers, ledgerParts, piggyBanks, piggyBankTransactions, monthlyPeriods } from '@/db/schema';
import { eq, and, desc } from 'drizzle-orm';
import { nowIso } from '@/lib/dates';

export type Transfer = typeof transfers.$inferSelect;

type TransferType =
  | 'AtoExternal'
  | 'BtoExternal'
  | 'ACashWithdrawal'
  | 'BCashWithdrawal'
  | 'CCashWithdrawal'
  | 'DCashWithdrawal'
  | 'DtoPiggyBank';

export function useTransfers() {
  const getTransfersForPeriod = useCallback(async (periodId: number): Promise<Transfer[]> => {
    return db
      .select()
      .from(transfers)
      .where(eq(transfers.periodId, periodId))
      .orderBy(desc(transfers.date));
  }, []);

  const addTransfer = useCallback(async (params: {
    periodId: number;
    amountCents: number;
    date: string;
    transferType: TransferType;
    sourcePart: 'A' | 'B' | 'C' | 'D';
    piggyBankId?: number;
    note?: string;
  }): Promise<Transfer> => {
    const [transfer] = await db
      .insert(transfers)
      .values({
        periodId: params.periodId,
        amountCents: params.amountCents,
        date: params.date,
        transferType: params.transferType,
        sourcePart: params.sourcePart,
        piggyBankId: params.piggyBankId ?? null,
        note: params.note ?? null,
        createdAt: nowIso(),
      })
      .returning();

    // Update the source part's ledger
    const parts = await db
      .select()
      .from(ledgerParts)
      .where(and(eq(ledgerParts.periodId, params.periodId), eq(ledgerParts.partType, params.sourcePart)));

    if (parts[0]) {
      const isWithdrawal = params.transferType.includes('CashWithdrawal');
      const isExternal = params.transferType.includes('toExternal');

      await db
        .update(ledgerParts)
        .set({
          currentBalanceCents: parts[0].currentBalanceCents - params.amountCents,
          transferredOutAmountCents: isExternal
            ? parts[0].transferredOutAmountCents + params.amountCents
            : parts[0].transferredOutAmountCents,
          withdrawnCashAmountCents: isWithdrawal
            ? parts[0].withdrawnCashAmountCents + params.amountCents
            : parts[0].withdrawnCashAmountCents,
        })
        .where(eq(ledgerParts.id, parts[0].id));
    }

    // If funding a piggy bank: update piggy bank balances and create a transaction
    if (params.transferType === 'DtoPiggyBank' && params.piggyBankId != null) {
      const pbs = await db.select().from(piggyBanks).where(eq(piggyBanks.id, params.piggyBankId));
      if (pbs[0]) {
        await db
          .update(piggyBanks)
          .set({
            totalAddedAllTimeCents: pbs[0].totalAddedAllTimeCents + params.amountCents,
            balanceOnAccountCents: pbs[0].balanceOnAccountCents + params.amountCents,
          })
          .where(eq(piggyBanks.id, params.piggyBankId));
      }

      await db.insert(piggyBankTransactions).values({
        piggyBankId: params.piggyBankId,
        date: params.date,
        amountCents: params.amountCents,
        type: 'add',
        balanceType: 'account',
        note: params.note ?? null,
        createdAt: nowIso(),
      });
    }

    return transfer;
  }, []);

  const deleteTransfer = useCallback(async (id: number): Promise<void> => {
    const [transfer] = await db.select().from(transfers).where(eq(transfers.id, id));
    if (!transfer) return;

    await db.delete(transfers).where(eq(transfers.id, id));

    // Restore source part balance
    const parts = await db
      .select()
      .from(ledgerParts)
      .where(and(eq(ledgerParts.periodId, transfer.periodId), eq(ledgerParts.partType, transfer.sourcePart)));

    if (parts[0]) {
      const isWithdrawal = transfer.transferType.includes('CashWithdrawal');
      const isExternal = transfer.transferType.includes('toExternal');

      await db
        .update(ledgerParts)
        .set({
          currentBalanceCents: parts[0].currentBalanceCents + transfer.amountCents,
          transferredOutAmountCents: isExternal
            ? parts[0].transferredOutAmountCents - transfer.amountCents
            : parts[0].transferredOutAmountCents,
          withdrawnCashAmountCents: isWithdrawal
            ? parts[0].withdrawnCashAmountCents - transfer.amountCents
            : parts[0].withdrawnCashAmountCents,
        })
        .where(eq(ledgerParts.id, parts[0].id));
    }

    // Reverse piggy bank effect
    if (transfer.transferType === 'DtoPiggyBank' && transfer.piggyBankId != null) {
      const pbs = await db.select().from(piggyBanks).where(eq(piggyBanks.id, transfer.piggyBankId));
      if (pbs[0]) {
        await db
          .update(piggyBanks)
          .set({
            totalAddedAllTimeCents: pbs[0].totalAddedAllTimeCents - transfer.amountCents,
            balanceOnAccountCents: pbs[0].balanceOnAccountCents - transfer.amountCents,
          })
          .where(eq(piggyBanks.id, transfer.piggyBankId));
      }
    }
  }, []);

  return { getTransfersForPeriod, addTransfer, deleteTransfer };
}
