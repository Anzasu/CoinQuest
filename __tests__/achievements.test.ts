import { checkAchievements, type AchievementCheckState, type AchievementDefinition } from '../src/lib/achievements';

const definitions: AchievementDefinition[] = [
  { code: 'donation_3', conditionType: 'donation_streak', conditionValue: 3 },
  { code: 'budget_1', conditionType: 'budget_under_count', conditionValue: 1 },
  { code: 'piggy_first', conditionType: 'piggy_bank_count', conditionValue: 1 },
  { code: 'savings_1000', conditionType: 'part_c_all_time_cents', conditionValue: 100000 },
  { code: 'level_5', conditionType: 'level', conditionValue: 5 },
];

function baseState(): AchievementCheckState {
  return {
    totalDonationsCompleted: 0,
    currentDonationStreak: 0,
    budgetUnderCount: 0,
    piggyBankCount: 0,
    piggyBankFundCount: 0,
    partCAllTimeCents: 0,
    currentLevel: 1,
  };
}

describe('checkAchievements', () => {
  test('no achievements met initially', () => {
    const result = checkAchievements(baseState(), definitions, new Set());
    expect(result).toHaveLength(0);
  });

  test('donation streak 3 unlocks donation_3', () => {
    const state = { ...baseState(), currentDonationStreak: 3 };
    const result = checkAchievements(state, definitions, new Set());
    expect(result).toContain('donation_3');
  });

  test('donation streak 2 does not unlock donation_3', () => {
    const state = { ...baseState(), currentDonationStreak: 2 };
    const result = checkAchievements(state, definitions, new Set());
    expect(result).not.toContain('donation_3');
  });

  test('budget_under_count = 1 unlocks budget_1', () => {
    const state = { ...baseState(), budgetUnderCount: 1 };
    const result = checkAchievements(state, definitions, new Set());
    expect(result).toContain('budget_1');
  });

  test('piggy_bank_count = 1 unlocks piggy_first', () => {
    const state = { ...baseState(), piggyBankCount: 1 };
    const result = checkAchievements(state, definitions, new Set());
    expect(result).toContain('piggy_first');
  });

  test('partCAllTimeCents >= 100000 unlocks savings_1000', () => {
    const state = { ...baseState(), partCAllTimeCents: 100000 };
    const result = checkAchievements(state, definitions, new Set());
    expect(result).toContain('savings_1000');
  });

  test('level 5 unlocks level_5', () => {
    const state = { ...baseState(), currentLevel: 5 };
    const result = checkAchievements(state, definitions, new Set());
    expect(result).toContain('level_5');
  });

  test('already unlocked achievements are skipped', () => {
    const state = { ...baseState(), currentDonationStreak: 10, currentLevel: 10 };
    const alreadyUnlocked = new Set(['donation_3']);
    const result = checkAchievements(state, definitions, alreadyUnlocked);
    expect(result).not.toContain('donation_3');
    expect(result).toContain('level_5');
  });

  test('multiple achievements can be unlocked at once', () => {
    const state = {
      ...baseState(),
      currentDonationStreak: 5,
      budgetUnderCount: 2,
      piggyBankCount: 3,
      partCAllTimeCents: 200000,
      currentLevel: 6,
    };
    const result = checkAchievements(state, definitions, new Set());
    expect(result).toContain('donation_3');
    expect(result).toContain('budget_1');
    expect(result).toContain('piggy_first');
    expect(result).toContain('savings_1000');
    expect(result).toContain('level_5');
    expect(result).toHaveLength(5);
  });
});
