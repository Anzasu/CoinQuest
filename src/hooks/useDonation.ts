import { useCallback } from 'react';
import { db } from '@/db';
import { donationRecords, monthlyPeriods, xpEvents } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { XP_AMOUNTS } from '@/lib/xp';
import { nowIso, todayIso } from '@/lib/dates';

export type DonationRecord = typeof donationRecords.$inferSelect;

export function useDonation() {
  const getDonationRecord = useCallback(async (periodId: number): Promise<DonationRecord | undefined> => {
    const rows = await db.select().from(donationRecords).where(eq(donationRecords.periodId, periodId));
    return rows[0];
  }, []);

  /**
   * Mark the donation as completed and award XP.
   */
  const completeDonation = useCallback(async (periodId: number): Promise<void> => {
    const rows = await db.select().from(donationRecords).where(eq(donationRecords.periodId, periodId));
    const record = rows[0];
    if (!record || record.status === 'completed') return;

    const xpAmount = XP_AMOUNTS.DONATION_COMPLETED;
    const now = nowIso();

    await db
      .update(donationRecords)
      .set({
        status: 'completed',
        completedAt: now,
        completedAmountCents: record.requiredAmountCents,
        xpAwarded: xpAmount,
      })
      .where(eq(donationRecords.id, record.id));

    // Update period
    await db
      .update(monthlyPeriods)
      .set({
        donationCompleted: true,
        donationCompletedAt: now,
        monthlyXpEarned: await incrementPeriodXp(periodId, xpAmount),
      })
      .where(eq(monthlyPeriods.id, periodId));

    // Record XP event
    await db.insert(xpEvents).values({
      date: todayIso(),
      periodId,
      reason: 'donation_completed',
      xpAmount,
      relatedEntityType: 'donation_record',
      relatedEntityId: record.id,
      createdAt: now,
    });
  }, []);

  /**
   * Mark the donation as missed (called when closing a month with pending donation).
   */
  const missedDonation = useCallback(async (periodId: number): Promise<void> => {
    const rows = await db.select().from(donationRecords).where(eq(donationRecords.periodId, periodId));
    const record = rows[0];
    if (!record || record.status !== 'pending') return;

    await db
      .update(donationRecords)
      .set({ status: 'missed', xpAwarded: 0 })
      .where(eq(donationRecords.id, record.id));
  }, []);

  const undoDonation = useCallback(async (periodId: number): Promise<void> => {
    const rows = await db.select().from(donationRecords).where(eq(donationRecords.periodId, periodId));
    const record = rows[0];
    if (!record || record.status !== 'completed') return;

    await db
      .update(donationRecords)
      .set({ status: 'pending', completedAt: null, completedAmountCents: 0, xpAwarded: 0 })
      .where(eq(donationRecords.id, record.id));

    await db
      .update(monthlyPeriods)
      .set({ donationCompleted: false, donationCompletedAt: null })
      .where(eq(monthlyPeriods.id, periodId));
  }, []);

  return { getDonationRecord, completeDonation, missedDonation, undoDonation };
}

async function incrementPeriodXp(periodId: number, amount: number): Promise<number> {
  const rows = await db.select().from(monthlyPeriods).where(eq(monthlyPeriods.id, periodId));
  return (rows[0]?.monthlyXpEarned ?? 0) + amount;
}
