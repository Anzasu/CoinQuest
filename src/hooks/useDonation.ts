import { useCallback } from 'react';
import { db } from '@/db';
import { donationRecords, monthlyPeriods, ledgerParts } from '@/db/schema';
import { eq, and } from 'drizzle-orm';
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

    // Deduct donation amount from Part D balance
    const dParts = await db
      .select()
      .from(ledgerParts)
      .where(and(eq(ledgerParts.periodId, periodId), eq(ledgerParts.partType, 'D')));
    if (dParts[0]) {
      await db
        .update(ledgerParts)
        .set({ currentBalanceCents: dParts[0].currentBalanceCents - record.requiredAmountCents })
        .where(eq(ledgerParts.id, dParts[0].id));
    }

    // Update period spent + donation flags
    const periodRows = await db.select().from(monthlyPeriods).where(eq(monthlyPeriods.id, periodId));
    const newSpent = (periodRows[0]?.monthlySpentCents ?? 0) + record.requiredAmountCents;
    await db
      .update(monthlyPeriods)
      .set({
        donationCompleted: true,
        donationCompletedAt: now,
        monthlySpentCents: newSpent,
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

    // Restore Part D balance
    const dParts = await db
      .select()
      .from(ledgerParts)
      .where(and(eq(ledgerParts.periodId, periodId), eq(ledgerParts.partType, 'D')));
    if (dParts[0]) {
      await db
        .update(ledgerParts)
        .set({ currentBalanceCents: dParts[0].currentBalanceCents + record.requiredAmountCents })
        .where(eq(ledgerParts.id, dParts[0].id));
    }

    // Restore period monthly spent
    const periodRows = await db.select().from(monthlyPeriods).where(eq(monthlyPeriods.id, periodId));
    const restoredSpent = Math.max(0, (periodRows[0]?.monthlySpentCents ?? 0) - record.requiredAmountCents);
    await db
      .update(monthlyPeriods)
      .set({ donationCompleted: false, donationCompletedAt: null, monthlySpentCents: restoredSpent })
      .where(eq(monthlyPeriods.id, periodId));
  }, []);

  return { getDonationRecord, completeDonation, missedDonation, undoDonation };
}
