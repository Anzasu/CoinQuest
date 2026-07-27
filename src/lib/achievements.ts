// Achievement check logic.
// Each check function receives the current app state and returns
// the achievement codes that should now be unlocked.

export interface AchievementCheckState {
  totalDonationsCompleted: number; // all-time count of completed donation months
  currentDonationStreak: number;   // consecutive completed months
  budgetUnderCount: number;        // total months stayed under overall budget
  piggyBankCount: number;          // number of piggy banks ever created
  piggyBankFundCount: number;      // total number of funding transactions
  partCAllTimeCents: number;       // all-time total for Part C
  currentLevel: number;
}

export interface AchievementDefinition {
  code: string;
  conditionType: string;
  conditionValue: number;
}

export function checkAchievements(
  state: AchievementCheckState,
  definitions: AchievementDefinition[],
  alreadyUnlocked: Set<string>,
): string[] {
  const newlyUnlocked: string[] = [];

  for (const def of definitions) {
    if (alreadyUnlocked.has(def.code)) continue;

    let met = false;
    switch (def.conditionType) {
      case 'donation_streak':
        met = state.currentDonationStreak >= def.conditionValue;
        break;
      case 'budget_under_count':
        met = state.budgetUnderCount >= def.conditionValue;
        break;
      case 'piggy_bank_count':
        met = state.piggyBankCount >= def.conditionValue;
        break;
      case 'piggy_bank_fund_count':
        met = state.piggyBankFundCount >= def.conditionValue;
        break;
      case 'part_c_all_time_cents':
        met = state.partCAllTimeCents >= def.conditionValue;
        break;
      case 'level':
        met = state.currentLevel >= def.conditionValue;
        break;
    }

    if (met) {
      newlyUnlocked.push(def.code);
    }
  }

  return newlyUnlocked;
}
