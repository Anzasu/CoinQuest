import { useState, useCallback } from 'react';
import { db } from '@/db';
import { monthlyPeriods, ledgerParts, donationRecords, budgets, monthlyBills, billTemplates } from '@/db/schema';
import { eq, desc, and } from 'drizzle-orm';
import { splitSalary, remainingAfterBills, calculateDonationGoal } from '@/lib/money';
import { nowIso } from '@/lib/dates';

export type Period = typeof monthlyPeriods.$inferSelect;
export type LedgerPart = typeof ledgerParts.$inferSelect;

export function usePeriods() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const getAllPeriods = useCallback(async (): Promise<Period[]> => {
    return db.select().from(monthlyPeriods).orderBy(desc(monthlyPeriods.year), desc(monthlyPeriods.month));
  }, []);

  const getPeriod = useCallback(async (id: number): Promise<Period | undefined> => {
    const rows = await db.select().from(monthlyPeriods).where(eq(monthlyPeriods.id, id));
    return rows[0];
  }, []);

  const getPeriodByMonthYear = useCallback(async (month: number, year: number): Promise<Period | undefined> => {
    const rows = await db
      .select()
      .from(monthlyPeriods)
      .where(and(eq(monthlyPeriods.month, month), eq(monthlyPeriods.year, year)));
    return rows[0];
  }, []);

  /**
   * Start a new month:
   * 1. Create the MonthlyPeriod record.
   * 2. Pre-fill monthly bills from active templates.
   * 3. Calculate A/B/C/D split.
   * 4. Create LedgerPart rows.
   * 5. Create DonationRecord.
   * 6. Carry over outstanding budget limit if set.
   */
  const startNewMonth = useCallback(async (params: {
    month: number;
    year: number;
    salaryAmountCents: number;
    bills: Array<{ templateId?: number; name: string; amountCents: number }>;
    monthlyBudgetLimitCents?: number;
    notes?: string;
  }): Promise<Period> => {
    setLoading(true);
    setError(null);

    try {
      const existing = await db
        .select()
        .from(monthlyPeriods)
        .where(and(eq(monthlyPeriods.month, params.month), eq(monthlyPeriods.year, params.year)));
      if (existing[0]) {
        throw new Error('This month has already been created.');
      }

      const totalBillsCents = params.bills.reduce((sum, b) => sum + b.amountCents, 0);
      const remainingCents = remainingAfterBills(params.salaryAmountCents, totalBillsCents);
      const split = splitSalary(remainingCents);
      const donationGoal = calculateDonationGoal(split.partD);
      const now = nowIso();

      // Create period
      const [period] = await db
        .insert(monthlyPeriods)
        .values({
          month: params.month,
          year: params.year,
          status: 'open',
          salaryAmountCents: params.salaryAmountCents,
          totalBillsAmountCents: totalBillsCents,
          remainingAfterBillsCents: remainingCents,
          partAAmountCents: split.partA,
          partBAmountCents: split.partB,
          partCAmountCents: split.partC,
          partDAmountCents: split.partD,
          donationGoalAmountCents: donationGoal,
          donationCompleted: false,
          monthlyBudgetLimitCents: params.monthlyBudgetLimitCents ?? null,
          notes: params.notes ?? null,
          createdAt: now,
        })
        .returning();

      // Insert bills for this period
      if (params.bills.length > 0) {
        await db.insert(monthlyBills).values(
          params.bills.map((b) => ({
            periodId: period.id,
            templateId: b.templateId ?? null,
            name: b.name,
            amountCents: b.amountCents,
            isPaid: true,
            createdAt: now,
          })),
        );
      }

      // Create ledger parts (starting balance will be updated by prior month carry-over logic)
      await db.insert(ledgerParts).values([
        { periodId: period.id, partType: 'A', startingAmountCents: split.partA, currentBalanceCents: split.partA, monthlyTotalCents: split.partA },
        { periodId: period.id, partType: 'B', startingAmountCents: split.partB, currentBalanceCents: split.partB, monthlyTotalCents: split.partB },
        { periodId: period.id, partType: 'C', startingAmountCents: split.partC, currentBalanceCents: split.partC, monthlyTotalCents: split.partC },
        { periodId: period.id, partType: 'D', startingAmountCents: split.partD, currentBalanceCents: split.partD, monthlyTotalCents: split.partD },
      ]);

      // Create donation record
      await db.insert(donationRecords).values({
        periodId: period.id,
        requiredAmountCents: donationGoal,
        completedAmountCents: 0,
        status: 'pending',
      });

      // Create overall budget if limit provided
      if (params.monthlyBudgetLimitCents != null) {
        await db.insert(budgets).values({
          periodId: period.id,
          scope: 'overall',
          limitAmountCents: params.monthlyBudgetLimitCents,
          spentAmountCents: 0,
          status: 'under',
          createdAt: now,
        });
      }

      return period;
    } finally {
      setLoading(false);
    }
  }, []);

  const closePeriod = useCallback(async (id: number): Promise<void> => {
    await db
      .update(monthlyPeriods)
      .set({ status: 'closed', closedAt: nowIso() })
      .where(eq(monthlyPeriods.id, id));
  }, []);

  const reopenPeriod = useCallback(async (id: number): Promise<void> => {
    await db
      .update(monthlyPeriods)
      .set({ status: 'open', closedAt: null })
      .where(eq(monthlyPeriods.id, id));
  }, []);

  const updatePeriodNotes = useCallback(async (id: number, notes: string): Promise<void> => {
    await db.update(monthlyPeriods).set({ notes }).where(eq(monthlyPeriods.id, id));
  }, []);

  const getLedgerParts = useCallback(async (periodId: number): Promise<LedgerPart[]> => {
    return db.select().from(ledgerParts).where(eq(ledgerParts.periodId, periodId));
  }, []);

  const getActiveBillTemplates = useCallback(async () => {
    return db
      .select()
      .from(billTemplates)
      .where(eq(billTemplates.isActive, true))
      .orderBy(billTemplates.sortOrder);
  }, []);

  return {
    loading,
    error,
    getAllPeriods,
    getPeriod,
    getPeriodByMonthYear,
    startNewMonth,
    closePeriod,
    reopenPeriod,
    updatePeriodNotes,
    getLedgerParts,
    getActiveBillTemplates,
  };
}
