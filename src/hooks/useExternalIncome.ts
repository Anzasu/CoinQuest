import { useCallback } from 'react';
import { db } from '@/db';
import { externalIncome, ledgerParts, monthlyPeriods } from '@/db/schema';
import { eq, and, desc } from 'drizzle-orm';

export type ExternalIncome = typeof externalIncome.$inferSelect;

export function useExternalIncome() {
  const getForPeriod = useCallback(async (periodId: number): Promise<ExternalIncome[]> => {
    return db
      .select()
      .from(externalIncome)
      .where(eq(externalIncome.periodId, periodId))
      .orderBy(desc(externalIncome.date));
  }, []);

  /**
   * Add external income (refund, gift, side income) directly to Part D.
   * Does NOT split into A/B/C/D — goes entirely to D.
   */
  const addExternalIncome = useCallback(async (params: {
    periodId: number;
    amountCents: number;
    type: 'refund' | 'gift' | 'sideIncome' | 'other';
    date: string;
    note?: string;
  }): Promise<ExternalIncome> => {
    const [record] = await db
      .insert(externalIncome)
      .values({
        periodId: params.periodId,
        amountCents: params.amountCents,
        type: params.type,
        date: params.date,
        note: params.note ?? null,
      })
      .returning();

    // Increase Part D current balance
    const parts = await db
      .select()
      .from(ledgerParts)
      .where(and(eq(ledgerParts.periodId, params.periodId), eq(ledgerParts.partType, 'D')));

    if (parts[0]) {
      await db
        .update(ledgerParts)
        .set({ currentBalanceCents: parts[0].currentBalanceCents + params.amountCents })
        .where(eq(ledgerParts.id, parts[0].id));
    }

    return record;
  }, []);

  const deleteExternalIncome = useCallback(async (id: number): Promise<void> => {
    const [record] = await db.select().from(externalIncome).where(eq(externalIncome.id, id));
    if (!record) return;

    await db.delete(externalIncome).where(eq(externalIncome.id, id));

    // Reverse the Part D increase
    const parts = await db
      .select()
      .from(ledgerParts)
      .where(and(eq(ledgerParts.periodId, record.periodId), eq(ledgerParts.partType, 'D')));

    if (parts[0]) {
      await db
        .update(ledgerParts)
        .set({ currentBalanceCents: parts[0].currentBalanceCents - record.amountCents })
        .where(eq(ledgerParts.id, parts[0].id));
    }
  }, []);

  return { getForPeriod, addExternalIncome, deleteExternalIncome };
}
