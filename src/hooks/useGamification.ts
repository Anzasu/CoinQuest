import { useCallback } from 'react';
import { db } from '@/db';
import { xpEvents, achievements, monthlyPeriods, donationRecords, piggyBanks, piggyBankTransactions, budgets } from '@/db/schema';
import { eq, sum, count, and } from 'drizzle-orm';
import { calculateLevel, levelProgress, xpToNextLevel, XP_AMOUNTS } from '@/lib/xp';
import { checkAchievements, type AchievementCheckState } from '@/lib/achievements';
import { nowIso, todayIso } from '@/lib/dates';

export function useGamification() {
  const getTotalXp = useCallback(async (): Promise<number> => {
    const rows = await db.select({ total: sum(xpEvents.xpAmount) }).from(xpEvents);
    return Number(rows[0]?.total ?? 0);
  }, []);

  const getGamificationStats = useCallback(async () => {
    const totalXp = await getTotalXp();
    const level = calculateLevel(totalXp);
    const progress = levelProgress(totalXp);
    const toNext = xpToNextLevel(totalXp);
    const allAchievements = await db.select().from(achievements);
    const unlockedCount = allAchievements.filter((a) => a.isUnlocked).length;

    return {
      totalXp,
      level,
      progress,
      xpToNextLevel: toNext,
      achievements: allAchievements,
      unlockedCount,
    };
  }, [getTotalXp]);

  const getRecentXpEvents = useCallback(async (limit = 10) => {
    const { desc } = await import('drizzle-orm');
    return db.select().from(xpEvents).orderBy(desc(xpEvents.date)).limit(limit);
  }, []);

  /**
   * Award XP for staying under the overall budget when closing a month.
   */
  const awardBudgetUnderXp = useCallback(async (periodId: number): Promise<void> => {
    const budget = await db
      .select()
      .from(budgets)
      .where(and(eq(budgets.periodId, periodId), eq(budgets.scope, 'overall')));

    if (!budget[0] || budget[0].status !== 'under') return;

    const xpAmount = XP_AMOUNTS.BUDGET_UNDER_OVERALL;
    const now = nowIso();

    await db.insert(xpEvents).values({
      date: todayIso(),
      periodId,
      reason: 'budget_under',
      xpAmount,
      relatedEntityType: 'budget',
      relatedEntityId: budget[0].id,
      createdAt: now,
    });

    // Update period XP
    const period = await db.select().from(monthlyPeriods).where(eq(monthlyPeriods.id, periodId));
    if (period[0]) {
      await db
        .update(monthlyPeriods)
        .set({ monthlyXpEarned: period[0].monthlyXpEarned + xpAmount })
        .where(eq(monthlyPeriods.id, periodId));
    }
  }, []);

  /**
   * Award XP for using piggy banks (one award per funding action).
   */
  const awardPiggyBankXp = useCallback(async (periodId: number, piggyBankId: number): Promise<void> => {
    const xpAmount = XP_AMOUNTS.PIGGY_BANK_FUNDED;
    const now = nowIso();

    await db.insert(xpEvents).values({
      date: todayIso(),
      periodId,
      reason: 'piggy_bank_used',
      xpAmount,
      relatedEntityType: 'piggy_bank',
      relatedEntityId: piggyBankId,
      createdAt: now,
    });

    const period = await db.select().from(monthlyPeriods).where(eq(monthlyPeriods.id, periodId));
    if (period[0]) {
      await db
        .update(monthlyPeriods)
        .set({ monthlyXpEarned: period[0].monthlyXpEarned + xpAmount })
        .where(eq(monthlyPeriods.id, periodId));
    }
  }, []);

  /**
   * Check and unlock any newly earned achievements.
   * Returns newly unlocked achievement codes.
   */
  const checkAndUnlockAchievements = useCallback(async (): Promise<string[]> => {
    const totalXp = await getTotalXp();
    const level = calculateLevel(totalXp);

    // Gather state
    const allDonations = await db.select().from(donationRecords);
    const completedDonations = allDonations.filter((d) => d.status === 'completed');

    // Calculate current donation streak
    const allPeriods = await db.select().from(monthlyPeriods).orderBy(monthlyPeriods.year, monthlyPeriods.month);
    let streak = 0;
    let maxStreak = 0;
    for (const p of allPeriods) {
      const donation = allDonations.find((d) => d.periodId === p.id);
      if (donation?.status === 'completed') {
        streak++;
        maxStreak = Math.max(maxStreak, streak);
      } else {
        streak = 0;
      }
    }

    const budgetUnderPeriods = await db
      .select()
      .from(budgets)
      .where(and(eq(budgets.scope, 'overall'), eq(budgets.status, 'under')));

    const allPiggyBanks = await db.select().from(piggyBanks);
    const allPbTxns = await db
      .select()
      .from(piggyBankTransactions)
      .where(eq(piggyBankTransactions.type, 'add'));

    // Part C all-time total: sum ledger_parts for C
    const { ledgerParts } = await import('@/db/schema');
    const partCRows = await db
      .select()
      .from(ledgerParts)
      .where(eq(ledgerParts.partType, 'C'));
    const partCAllTime = partCRows.reduce((s, r) => s + r.monthlyTotalCents, 0);

    const state: AchievementCheckState = {
      totalDonationsCompleted: completedDonations.length,
      currentDonationStreak: maxStreak,
      budgetUnderCount: budgetUnderPeriods.length,
      piggyBankCount: allPiggyBanks.length,
      piggyBankFundCount: allPbTxns.length,
      partCAllTimeCents: partCAllTime,
      currentLevel: level,
    };

    const allAchievements = await db.select().from(achievements);
    const alreadyUnlocked = new Set(
      allAchievements.filter((a) => a.isUnlocked).map((a) => a.code),
    );

    const newCodes = checkAchievements(state, allAchievements, alreadyUnlocked);

    if (newCodes.length > 0) {
      const now = nowIso();
      for (const code of newCodes) {
        await db
          .update(achievements)
          .set({ isUnlocked: true, unlockedAt: now })
          .where(eq(achievements.code, code));

        // Award XP for unlocking
        await db.insert(xpEvents).values({
          date: todayIso(),
          reason: 'achievement_unlocked',
          xpAmount: XP_AMOUNTS.ACHIEVEMENT_UNLOCKED,
          relatedEntityType: 'achievement',
          createdAt: now,
        });
      }
    }

    return newCodes;
  }, [getTotalXp]);

  return {
    getTotalXp,
    getGamificationStats,
    getRecentXpEvents,
    awardBudgetUnderXp,
    awardPiggyBankXp,
    checkAndUnlockAchievements,
  };
}
