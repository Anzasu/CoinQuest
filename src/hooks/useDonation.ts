import { useCallback } from 'react';
import { db } from '@/db';
import { donationRecords, ledgerParts, monthlyPeriods } from '@/db/schema';
import { and, eq } from 'drizzle-orm';
import { nowIso } from '@/lib/dates';
import { getOverallPartBalance } from '@/lib/partBalances';

export type DonationRecord = typeof donationRecords.$inferSelect;

export function useDonation() {
  const getDonationRecord = useCallback(async (periodId: number): Promise<DonationRecord | undefined> => {
    const rows = await db.select().from(donationRecords).where(eq(donationRecords.periodId, periodId));
    return rows[0];
  }, []);

  const completeDonation = useCallback(async (periodId: number, amountCents: number): Promise<void> => {
    const rows = await db.select().from(donationRecords).where(eq(donationRecords.periodId, periodId));
    const record = rows[0];
    if (!record || record.status === 'completed') return;
    if (amountCents <= 0) throw new Error('Enter a valid donation amount.');

    const [partD] = await db
      .select()
      .from(ledgerParts)
      .where(and(eq(ledgerParts.periodId, periodId), eq(ledgerParts.partType, 'D')));
    if (!partD) throw new Error('This month has no Spending part.');
    const overallAvailable = await getOverallPartBalance('D');
    if (amountCents > overallAvailable) throw new Error('The donation exceeds the all-time Spending balance.');

    const now = nowIso();

    await db
      .update(donationRecords)
      .set({
        status: 'completed',
        completedAt: now,
        completedAmountCents: amountCents,
      })
      .where(eq(donationRecords.id, record.id));

    await db
      .update(ledgerParts)
      .set({
        currentBalanceCents: partD.currentBalanceCents - amountCents,
        transferredOutAmountCents: partD.transferredOutAmountCents + amountCents,
      })
      .where(eq(ledgerParts.id, partD.id));

    await db
      .update(monthlyPeriods)
      .set({
        donationCompleted: true,
        donationCompletedAt: now,
      })
      .where(eq(monthlyPeriods.id, periodId));
  }, []);

  const missedDonation = useCallback(async (periodId: number): Promise<void> => {
    const rows = await db.select().from(donationRecords).where(eq(donationRecords.periodId, periodId));
    const record = rows[0];
    if (!record || record.status !== 'pending') return;

    await db
      .update(donationRecords)
      .set({ status: 'missed' })
      .where(eq(donationRecords.id, record.id));
  }, []);

  const undoDonation = useCallback(async (periodId: number): Promise<void> => {
    const rows = await db.select().from(donationRecords).where(eq(donationRecords.periodId, periodId));
    const record = rows[0];
    if (!record || record.status !== 'completed') return;

    const [partD] = await db
      .select()
      .from(ledgerParts)
      .where(and(eq(ledgerParts.periodId, periodId), eq(ledgerParts.partType, 'D')));
    if (partD) {
      await db
        .update(ledgerParts)
        .set({
          currentBalanceCents: partD.currentBalanceCents + record.completedAmountCents,
          transferredOutAmountCents: Math.max(0, partD.transferredOutAmountCents - record.completedAmountCents),
        })
        .where(eq(ledgerParts.id, partD.id));
    }

    await db
      .update(donationRecords)
      .set({ status: 'pending', completedAt: null, completedAmountCents: 0 })
      .where(eq(donationRecords.id, record.id));

    await db
      .update(monthlyPeriods)
      .set({ donationCompleted: false, donationCompletedAt: null })
      .where(eq(monthlyPeriods.id, periodId));
  }, []);

  return { getDonationRecord, completeDonation, missedDonation, undoDonation };
}
