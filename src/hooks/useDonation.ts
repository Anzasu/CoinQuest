import { useCallback } from 'react';
import { db } from '@/db';
import { donationRecords, monthlyPeriods } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { nowIso } from '@/lib/dates';

export type DonationRecord = typeof donationRecords.$inferSelect;

export function useDonation() {
  const getDonationRecord = useCallback(async (periodId: number): Promise<DonationRecord | undefined> => {
    const rows = await db.select().from(donationRecords).where(eq(donationRecords.periodId, periodId));
    return rows[0];
  }, []);

  const completeDonation = useCallback(async (periodId: number): Promise<void> => {
    const rows = await db.select().from(donationRecords).where(eq(donationRecords.periodId, periodId));
    const record = rows[0];
    if (!record || record.status === 'completed') return;

    const now = nowIso();

    await db
      .update(donationRecords)
      .set({
        status: 'completed',
        completedAt: now,
        completedAmountCents: record.requiredAmountCents,
      })
      .where(eq(donationRecords.id, record.id));

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
