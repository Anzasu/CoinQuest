import { useCallback } from 'react';
import { db } from '@/db';
import { piggyBanks, piggyBankTransactions, expenses } from '@/db/schema';
import { eq, desc } from 'drizzle-orm';
import { nowIso } from '@/lib/dates';

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
  }): Promise<PiggyBank> => {
    const [pb] = await db
      .insert(piggyBanks)
      .values({
        name: params.name,
        openingCashBalanceCents: params.openingCashBalanceCents,
        // Opening cash goes directly into balanceCash — does NOT reduce Part D
        balanceCashCents: params.openingCashBalanceCents,
        totalAddedAllTimeCents: 0,
        totalRemovedAllTimeCents: 0,
        totalSpentAllTimeCents: 0,
        balanceOnAccountCents: 0,
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

  /**
   * Remove money from a piggy bank (type='remove': take back to Part D or general use).
   * This does NOT create an expense — it just reduces the piggy bank balance.
   */
  const removeFunds = useCallback(async (params: {
    piggyBankId: number;
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
        totalRemovedAllTimeCents: pb.totalRemovedAllTimeCents + params.amountCents,
      })
      .where(eq(piggyBanks.id, params.piggyBankId));

    await db.insert(piggyBankTransactions).values({
      piggyBankId: params.piggyBankId,
      date: params.date,
      amountCents: params.amountCents,
      type: 'remove',
      balanceType: params.balanceType,
      note: params.note ?? null,
      createdAt: nowIso(),
    });
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

  return {
    getAllPiggyBanks,
    getPiggyBank,
    getTransactions,
    createPiggyBank,
    updatePiggyBank,
    archivePiggyBank,
    removeFunds,
    spendFromPiggyBank,
  };
}
