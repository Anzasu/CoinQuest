import { useCallback } from 'react';
import { db } from '@/db';
import { piggyBanks, piggyBankTransactions, ledgerParts, externalIncome, transfers } from '@/db/schema';
import { eq, desc, and } from 'drizzle-orm';
import { nowIso } from '@/lib/dates';
import { getOverallPartBalance } from '@/lib/partBalances';

export type PiggyBank = typeof piggyBanks.$inferSelect;
export type PiggyBankTransaction = typeof piggyBankTransactions.$inferSelect;

export function usePiggyBanks() {
  const getAllPiggyBanks = useCallback(async (): Promise<PiggyBank[]> => {
    return db.select().from(piggyBanks).orderBy(piggyBanks.createdAt);
  }, []);

  const getPiggyBank = useCallback(async (id: number): Promise<PiggyBank | undefined> => {
    const rows = await db.select().from(piggyBanks).where(eq(piggyBanks.id, id));
    return rows[0];
  }, []);

  const getTransactions = useCallback(async (piggyBankId: number): Promise<PiggyBankTransaction[]> => {
    return db
      .select()
      .from(piggyBankTransactions)
      .where(eq(piggyBankTransactions.piggyBankId, piggyBankId))
      .orderBy(desc(piggyBankTransactions.date));
  }, []);

  const createPiggyBank = useCallback(async (params: {
    name: string;
    openingCashBalanceCents: number;
    openingAccountBalanceCents?: number;
  }): Promise<PiggyBank> => {
    const openingAccount = params.openingAccountBalanceCents ?? 0;
    const [pb] = await db
      .insert(piggyBanks)
      .values({
        name: params.name,
        openingCashBalanceCents: params.openingCashBalanceCents,
        balanceCashCents: params.openingCashBalanceCents,
        balanceOnAccountCents: openingAccount,
        totalAddedAllTimeCents: 0,
        totalRemovedAllTimeCents: 0,
        totalSpentAllTimeCents: 0,
        isArchived: false,
        createdAt: nowIso(),
      })
      .returning();

    // Record the opening cash as a setup transaction if non-zero
    if (params.openingCashBalanceCents > 0) {
      await db.insert(piggyBankTransactions).values({
        piggyBankId: pb.id,
        date: pb.createdAt.split('T')[0],
        amountCents: params.openingCashBalanceCents,
        type: 'add',
        balanceType: 'cash',
        note: 'Opening cash balance (pre-app)',
        createdAt: nowIso(),
      });
    }

    // Record the opening account balance as a setup transaction if non-zero
    if (openingAccount > 0) {
      await db.insert(piggyBankTransactions).values({
        piggyBankId: pb.id,
        date: pb.createdAt.split('T')[0],
        amountCents: openingAccount,
        type: 'add',
        balanceType: 'account',
        note: 'Opening account balance (pre-app)',
        createdAt: nowIso(),
      });
    }

    return pb;
  }, []);

  const updatePiggyBank = useCallback(async (
    id: number,
    params: { name: string; openingCashBalanceCents: number },
  ): Promise<void> => {
    const [current] = await db.select().from(piggyBanks).where(eq(piggyBanks.id, id));
    if (!current) return;

    const cashDelta = params.openingCashBalanceCents - current.openingCashBalanceCents;

    await db
      .update(piggyBanks)
      .set({
        name: params.name,
        openingCashBalanceCents: params.openingCashBalanceCents,
        balanceCashCents: current.balanceCashCents + cashDelta,
      })
      .where(eq(piggyBanks.id, id));
  }, []);

  const archivePiggyBank = useCallback(async (id: number): Promise<void> => {
    await db.update(piggyBanks).set({ isArchived: true }).where(eq(piggyBanks.id, id));
  }, []);

  const unarchivePiggyBank = useCallback(async (id: number): Promise<void> => {
    await db.update(piggyBanks).set({ isArchived: false }).where(eq(piggyBanks.id, id));
  }, []);

  const deletePiggyBank = useCallback(async (id: number, periodId?: number): Promise<void> => {
    const [pb] = await db.select().from(piggyBanks).where(eq(piggyBanks.id, id));
    if (!pb) return;

    const remainingBalance = pb.balanceOnAccountCents + pb.balanceCashCents;
    if (remainingBalance > 0) {
      if (!periodId) throw new Error('Start a month before deleting a piggy bank that still has a balance.');

      const [partD] = await db
        .select()
        .from(ledgerParts)
        .where(and(eq(ledgerParts.periodId, periodId), eq(ledgerParts.partType, 'D')));
      if (!partD) throw new Error('The selected month has no Spending part.');

      await db.insert(externalIncome).values({
        periodId,
        amountCents: remainingBalance,
        type: 'other',
        date: nowIso().split('T')[0],
        note: 'piggy bank deleted',
      });
      await db
        .update(ledgerParts)
        .set({
          currentBalanceCents: partD.currentBalanceCents + remainingBalance,
          monthlyTotalCents: partD.monthlyTotalCents + remainingBalance,
        })
        .where(eq(ledgerParts.id, partD.id));
    }

    await db.update(transfers).set({ piggyBankId: null }).where(eq(transfers.piggyBankId, id));
    await db.delete(piggyBankTransactions).where(eq(piggyBankTransactions.piggyBankId, id));
    await db.delete(piggyBanks).where(eq(piggyBanks.id, id));
  }, []);

  const deleteTransaction = useCallback(async (txnId: number): Promise<void> => {
    const [txn] = await db.select().from(piggyBankTransactions).where(eq(piggyBankTransactions.id, txnId));
    if (!txn) return;
    const [pb] = await db.select().from(piggyBanks).where(eq(piggyBanks.id, txn.piggyBankId));
    if (!pb) return;
    const isAccount = txn.balanceType === 'account';
    const currentBal = isAccount ? pb.balanceOnAccountCents : pb.balanceCashCents;

    if (txn.type === 'add') {
      await db.update(piggyBanks).set({
        [isAccount ? 'balanceOnAccountCents' : 'balanceCashCents']: currentBal - txn.amountCents,
        totalAddedAllTimeCents: pb.totalAddedAllTimeCents - txn.amountCents,
      }).where(eq(piggyBanks.id, pb.id));
    } else if (txn.type === 'remove' || txn.type === 'return') {
      if (txn.type === 'return') {
        const overallAvailable = await getOverallPartBalance('D');
        if (txn.amountCents > overallAvailable) {
          throw new Error('This return cannot be reverted because part of it has already been spent.');
        }
      }
      await db.update(piggyBanks).set({
        [isAccount ? 'balanceOnAccountCents' : 'balanceCashCents']: currentBal + txn.amountCents,
        totalRemovedAllTimeCents: pb.totalRemovedAllTimeCents - txn.amountCents,
      }).where(eq(piggyBanks.id, pb.id));

      if (txn.type === 'return') {
        const { monthlyPeriods } = await import('@/db/schema');
        const date = new Date(txn.date);
        const [period] = await db.select().from(monthlyPeriods).where(
          and(eq(monthlyPeriods.month, date.getMonth() + 1), eq(monthlyPeriods.year, date.getFullYear()))
        );
        if (period) {
          const [partD] = await db.select().from(ledgerParts).where(
            and(eq(ledgerParts.periodId, period.id), eq(ledgerParts.partType, 'D'))
          );
          if (partD) {
            await db.update(ledgerParts).set({
              currentBalanceCents: partD.currentBalanceCents - txn.amountCents,
              monthlyTotalCents: partD.monthlyTotalCents - txn.amountCents,
            }).where(eq(ledgerParts.id, partD.id));
          }
        }
      }
    } else if (txn.type === 'spend') {
      await db.update(piggyBanks).set({
        [isAccount ? 'balanceOnAccountCents' : 'balanceCashCents']: currentBal + txn.amountCents,
        totalSpentAllTimeCents: pb.totalSpentAllTimeCents - txn.amountCents,
      }).where(eq(piggyBanks.id, pb.id));
      const { monthlyPeriods } = await import('@/db/schema');
      const { and: andI, eq: eqI } = await import('drizzle-orm');
      const d = new Date(txn.date);
      const periods = await db.select().from(monthlyPeriods).where(
        andI(eqI(monthlyPeriods.month, d.getMonth() + 1), eqI(monthlyPeriods.year, d.getFullYear()))
      );
      if (periods[0] && periods[0].monthlySpentFromPiggyBanksCents > 0) {
        await db.update(monthlyPeriods).set({
          monthlySpentFromPiggyBanksCents: periods[0].monthlySpentFromPiggyBanksCents - txn.amountCents,
        }).where(eqI(monthlyPeriods.id, periods[0].id));
      }
    }

    await db.delete(piggyBankTransactions).where(eq(piggyBankTransactions.id, txnId));
  }, []);

  /**
   * Return money from a piggy bank back to Spending (Part D).
   */
  const returnToSpending = useCallback(async (params: {
    piggyBankId: number;
    periodId: number;
    amountCents: number;
    balanceType: 'account' | 'cash';
    date: string;
    note?: string;
  }): Promise<void> => {
    const [pb] = await db.select().from(piggyBanks).where(eq(piggyBanks.id, params.piggyBankId));
    if (!pb) throw new Error('Piggy bank not found.');

    const balanceField = params.balanceType === 'account' ? 'balanceOnAccountCents' : 'balanceCashCents';
    const availableBalance = params.balanceType === 'account' ? pb.balanceOnAccountCents : pb.balanceCashCents;
    if (params.amountCents <= 0 || params.amountCents > availableBalance) {
      throw new Error(`The ${params.balanceType} balance is too low.`);
    }

    const parts = await db.select().from(ledgerParts).where(
      and(eq(ledgerParts.periodId, params.periodId), eq(ledgerParts.partType, 'D'))
    );
    if (!parts[0]) throw new Error('The selected month has no Spending part.');

    await db
      .update(piggyBanks)
      .set({
        [balanceField]: availableBalance - params.amountCents,
        totalRemovedAllTimeCents: pb.totalRemovedAllTimeCents + params.amountCents,
      })
      .where(eq(piggyBanks.id, params.piggyBankId));

    await db.insert(piggyBankTransactions).values({
      piggyBankId: params.piggyBankId,
      date: params.date,
      amountCents: params.amountCents,
      type: 'return',
      balanceType: params.balanceType,
      note: params.note ?? `Returned to Spending`,
      createdAt: nowIso(),
    });

    await db.update(ledgerParts).set({
      currentBalanceCents: parts[0].currentBalanceCents + params.amountCents,
      monthlyTotalCents: parts[0].monthlyTotalCents + params.amountCents,
    }).where(eq(ledgerParts.id, parts[0].id));
  }, []);

  /**
   * Spend from a piggy bank (type='spend').
   * This represents spending tracked inside the piggy bank.
   * The dashboard shows combined piggy bank spending totals.
   */
  const spendFromPiggyBank = useCallback(async (params: {
    piggyBankId: number;
    periodId: number;
    amountCents: number;
    balanceType: 'account' | 'cash';
    date: string;
    note?: string;
  }): Promise<void> => {
    const [pb] = await db.select().from(piggyBanks).where(eq(piggyBanks.id, params.piggyBankId));
    if (!pb) return;

    const balanceField = params.balanceType === 'account' ? 'balanceOnAccountCents' : 'balanceCashCents';

    await db
      .update(piggyBanks)
      .set({
        [balanceField]: (params.balanceType === 'account' ? pb.balanceOnAccountCents : pb.balanceCashCents) - params.amountCents,
        totalSpentAllTimeCents: pb.totalSpentAllTimeCents + params.amountCents,
      })
      .where(eq(piggyBanks.id, params.piggyBankId));

    const [txn] = await db
      .insert(piggyBankTransactions)
      .values({
        piggyBankId: params.piggyBankId,
        date: params.date,
        amountCents: params.amountCents,
        type: 'spend',
        balanceType: params.balanceType,
        note: params.note ?? null,
        createdAt: nowIso(),
      })
      .returning();

    // Update period piggy bank spending total
    const { monthlyPeriods } = await import('@/db/schema');
    const { eq: eqInner } = await import('drizzle-orm');
    const period = await db
      .select()
      .from(monthlyPeriods)
      .where(eqInner(monthlyPeriods.id, params.periodId));
    if (period[0]) {
      await db
        .update(monthlyPeriods)
        .set({
          monthlySpentFromPiggyBanksCents:
            period[0].monthlySpentFromPiggyBanksCents + params.amountCents,
        })
        .where(eqInner(monthlyPeriods.id, params.periodId));
    }
  }, []);

  const transferBetweenPiggyBanks = useCallback(async (params: {
    fromId: number;
    toId: number;
    amountCents: number;
    balanceType: 'account' | 'cash';
    date: string;
    note?: string;
  }): Promise<void> => {
    const [from] = await db.select().from(piggyBanks).where(eq(piggyBanks.id, params.fromId));
    const [to] = await db.select().from(piggyBanks).where(eq(piggyBanks.id, params.toId));
    if (!from || !to) return;
    const isAccount = params.balanceType === 'account';
    const fromBal = isAccount ? from.balanceOnAccountCents : from.balanceCashCents;
    const toBal = isAccount ? to.balanceOnAccountCents : to.balanceCashCents;
    await db.update(piggyBanks).set({
      [isAccount ? 'balanceOnAccountCents' : 'balanceCashCents']: fromBal - params.amountCents,
      totalRemovedAllTimeCents: from.totalRemovedAllTimeCents + params.amountCents,
    }).where(eq(piggyBanks.id, params.fromId));
    await db.update(piggyBanks).set({
      [isAccount ? 'balanceOnAccountCents' : 'balanceCashCents']: toBal + params.amountCents,
      totalAddedAllTimeCents: to.totalAddedAllTimeCents + params.amountCents,
    }).where(eq(piggyBanks.id, params.toId));
    const noteFrom = `Transfer to ${to.name}${params.note ? ` · ${params.note}` : ''}`;
    const noteTo = `Transfer from ${from.name}${params.note ? ` · ${params.note}` : ''}`;
    await db.insert(piggyBankTransactions).values([
      { piggyBankId: params.fromId, date: params.date, amountCents: params.amountCents, type: 'remove', balanceType: params.balanceType, note: noteFrom, createdAt: nowIso() },
      { piggyBankId: params.toId, date: params.date, amountCents: params.amountCents, type: 'add', balanceType: params.balanceType, note: noteTo, createdAt: nowIso() },
    ]);
  }, []);

  return {
    getAllPiggyBanks,
    getPiggyBank,
    getTransactions,
    createPiggyBank,
    updatePiggyBank,
    archivePiggyBank,
    unarchivePiggyBank,
    deletePiggyBank,
    returnToSpending,
    spendFromPiggyBank,
    deleteTransaction,
    transferBetweenPiggyBanks,
  };
}
