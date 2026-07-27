// XP and leveling system.
// XP is earned only when rules are fulfilled — NOT per transaction.

export const XP_AMOUNTS = {
  DONATION_COMPLETED: 100,
  BUDGET_UNDER_OVERALL: 50,
  BUDGET_UNDER_CATEGORY: 20,
  PIGGY_BANK_FUNDED: 15,
  GOAL_REACHED: 75,
  ACHIEVEMENT_UNLOCKED: 30,
} as const;

export type XpReason = keyof typeof XP_AMOUNTS;

/**
 * Dynamic level threshold formula:
 * Level N requires totalXP >= threshold(N).
 *
 * threshold(1) = 0 (everyone starts at level 1)
 * threshold(N) = threshold(N-1) + 100 * N   for N > 1
 *
 * This means each new level costs 100 more XP than the previous.
 * Level 2: 200 XP
 * Level 3: 200 + 300 = 500 XP
 * Level 4: 500 + 400 = 900 XP
 * Level 5: 900 + 500 = 1400 XP
 * ...
 */
export function levelThreshold(level: number): number {
  if (level <= 1) return 0;
  // threshold(N) = sum of 100*k for k=2..N = 100 * sum(k, 2..N)
  // sum(k, 2..N) = N*(N+1)/2 - 1
  return 100 * (Math.floor((level * (level + 1)) / 2) - 1);
}

/**
 * Calculate the current level from total XP.
 */
export function calculateLevel(totalXp: number): number {
  let level = 1;
  while (levelThreshold(level + 1) <= totalXp) {
    level++;
  }
  return level;
}

/**
 * XP needed to reach the next level from the current level.
 */
export function xpToNextLevel(totalXp: number): number {
  const currentLevel = calculateLevel(totalXp);
  const nextThreshold = levelThreshold(currentLevel + 1);
  return nextThreshold - totalXp;
}

/**
 * Progress (0–1) within the current level band.
 */
export function levelProgress(totalXp: number): number {
  const currentLevel = calculateLevel(totalXp);
  const currentThreshold = levelThreshold(currentLevel);
  const nextThreshold = levelThreshold(currentLevel + 1);
  const band = nextThreshold - currentThreshold;
  if (band === 0) return 1;
  return (totalXp - currentThreshold) / band;
}

/**
 * Total XP across all XP events.
 */
export function sumXp(xpAmounts: number[]): number {
  return xpAmounts.reduce((acc, v) => acc + v, 0);
}
