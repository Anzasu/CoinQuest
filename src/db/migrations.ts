import * as SQLite from 'expo-sqlite';

// Run all CREATE TABLE statements in order. Safe to re-run (IF NOT EXISTS).
export async function runMigrations(db: SQLite.SQLiteDatabase): Promise<void> {
  await db.execAsync(`
    PRAGMA journal_mode = WAL;
    PRAGMA foreign_keys = ON;

    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL DEFAULT 'Me',
      currency TEXT NOT NULL DEFAULT 'EUR',
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS app_settings (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      theme TEXT NOT NULL DEFAULT 'dark',
      user_name TEXT NOT NULL DEFAULT 'Me',
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS bill_templates (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      amount_cents INTEGER NOT NULL,
      is_active INTEGER NOT NULL DEFAULT 1,
      sort_order INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS monthly_periods (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      month INTEGER NOT NULL,
      year INTEGER NOT NULL,
      status TEXT NOT NULL DEFAULT 'open',
      salary_amount_cents INTEGER NOT NULL DEFAULT 0,
      total_bills_amount_cents INTEGER NOT NULL DEFAULT 0,
      remaining_after_bills_cents INTEGER NOT NULL DEFAULT 0,
      part_a_amount_cents INTEGER NOT NULL DEFAULT 0,
      part_b_amount_cents INTEGER NOT NULL DEFAULT 0,
      part_c_amount_cents INTEGER NOT NULL DEFAULT 0,
      part_d_amount_cents INTEGER NOT NULL DEFAULT 0,
      donation_goal_amount_cents INTEGER NOT NULL DEFAULT 0,
      donation_completed INTEGER NOT NULL DEFAULT 0,
      donation_completed_at TEXT,
      monthly_xp_earned INTEGER NOT NULL DEFAULT 0,
      monthly_budget_limit_cents INTEGER,
      monthly_spent_cents INTEGER NOT NULL DEFAULT 0,
      monthly_spent_from_piggy_banks_cents INTEGER NOT NULL DEFAULT 0,
      notes TEXT,
      created_at TEXT NOT NULL,
      closed_at TEXT,
      UNIQUE(month, year)
    );

    CREATE TABLE IF NOT EXISTS monthly_bills (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      period_id INTEGER NOT NULL REFERENCES monthly_periods(id),
      template_id INTEGER REFERENCES bill_templates(id),
      name TEXT NOT NULL,
      amount_cents INTEGER NOT NULL,
      is_paid INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS ledger_parts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      period_id INTEGER NOT NULL REFERENCES monthly_periods(id),
      part_type TEXT NOT NULL,
      starting_amount_cents INTEGER NOT NULL DEFAULT 0,
      current_balance_cents INTEGER NOT NULL DEFAULT 0,
      monthly_total_cents INTEGER NOT NULL DEFAULT 0,
      yearly_total_cents INTEGER NOT NULL DEFAULT 0,
      all_time_total_cents INTEGER NOT NULL DEFAULT 0,
      transferred_out_amount_cents INTEGER NOT NULL DEFAULT 0,
      withdrawn_cash_amount_cents INTEGER NOT NULL DEFAULT 0,
      spent_amount_cents INTEGER NOT NULL DEFAULT 0,
      UNIQUE(period_id, part_type)
    );

    CREATE TABLE IF NOT EXISTS legacy_part_imports (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      part_type TEXT NOT NULL,
      amount_cents INTEGER NOT NULL,
      date_imported TEXT NOT NULL,
      note TEXT,
      created_at TEXT NOT NULL,
      counts_toward_all_time_total INTEGER NOT NULL DEFAULT 1
    );

    CREATE TABLE IF NOT EXISTS external_income (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      period_id INTEGER NOT NULL REFERENCES monthly_periods(id),
      amount_cents INTEGER NOT NULL,
      type TEXT NOT NULL,
      date TEXT NOT NULL,
      note TEXT
    );

    CREATE TABLE IF NOT EXISTS expenses (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      period_id INTEGER NOT NULL REFERENCES monthly_periods(id),
      amount_cents INTEGER NOT NULL,
      date TEXT NOT NULL,
      category TEXT NOT NULL,
      payment_method TEXT NOT NULL,
      note TEXT,
      counts_toward_spending INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS transfers (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      period_id INTEGER NOT NULL REFERENCES monthly_periods(id),
      amount_cents INTEGER NOT NULL,
      date TEXT NOT NULL,
      transfer_type TEXT NOT NULL,
      source_part TEXT NOT NULL,
      piggy_bank_id INTEGER REFERENCES piggy_banks(id),
      note TEXT,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS piggy_banks (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      opening_cash_balance_cents INTEGER NOT NULL DEFAULT 0,
      total_added_all_time_cents INTEGER NOT NULL DEFAULT 0,
      total_removed_all_time_cents INTEGER NOT NULL DEFAULT 0,
      total_spent_all_time_cents INTEGER NOT NULL DEFAULT 0,
      balance_on_account_cents INTEGER NOT NULL DEFAULT 0,
      balance_cash_cents INTEGER NOT NULL DEFAULT 0,
      is_archived INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS piggy_bank_transactions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      piggy_bank_id INTEGER NOT NULL REFERENCES piggy_banks(id),
      date TEXT NOT NULL,
      amount_cents INTEGER NOT NULL,
      type TEXT NOT NULL,
      balance_type TEXT NOT NULL DEFAULT 'account',
      note TEXT,
      linked_expense_id INTEGER REFERENCES expenses(id),
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS donation_records (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      period_id INTEGER NOT NULL REFERENCES monthly_periods(id),
      required_amount_cents INTEGER NOT NULL,
      completed_amount_cents INTEGER NOT NULL DEFAULT 0,
      status TEXT NOT NULL DEFAULT 'pending',
      completed_at TEXT,
      xp_awarded INTEGER NOT NULL DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS budgets (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      period_id INTEGER NOT NULL REFERENCES monthly_periods(id),
      scope TEXT NOT NULL,
      category TEXT,
      limit_amount_cents INTEGER NOT NULL,
      spent_amount_cents INTEGER NOT NULL DEFAULT 0,
      status TEXT NOT NULL DEFAULT 'under',
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS xp_events (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      date TEXT NOT NULL,
      period_id INTEGER REFERENCES monthly_periods(id),
      reason TEXT NOT NULL,
      xp_amount INTEGER NOT NULL,
      related_entity_type TEXT,
      related_entity_id INTEGER,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS achievements (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      code TEXT NOT NULL UNIQUE,
      name TEXT NOT NULL,
      description TEXT NOT NULL,
      unlocked_at TEXT,
      condition_type TEXT NOT NULL,
      condition_value INTEGER NOT NULL,
      is_unlocked INTEGER NOT NULL DEFAULT 0
    );
  `);

  // Seed app_settings singleton if not present
  await db.execAsync(`
    INSERT OR IGNORE INTO app_settings (id, theme, user_name, created_at, updated_at)
    VALUES (1, 'dark', 'Me', datetime('now'), datetime('now'));
  `);

  // Seed achievements
  await seedAchievements(db);
}

async function seedAchievements(db: SQLite.SQLiteDatabase): Promise<void> {
  const achievements = [
    // Donation streaks
    { code: 'donation_1', name: 'First Donor', description: 'Complete your first monthly donation goal.', conditionType: 'donation_streak', conditionValue: 1 },
    { code: 'donation_3', name: 'Generous Soul', description: 'Complete donation goals 3 months in a row.', conditionType: 'donation_streak', conditionValue: 3 },
    { code: 'donation_6', name: 'Philanthropist', description: 'Complete donation goals 6 months in a row.', conditionType: 'donation_streak', conditionValue: 6 },
    { code: 'donation_12', name: 'Year of Giving', description: 'Complete donation goals 12 months in a row.', conditionType: 'donation_streak', conditionValue: 12 },
    // Budget milestones
    { code: 'budget_1', name: 'Budget Starter', description: 'Stay under your monthly budget for the first time.', conditionType: 'budget_under_count', conditionValue: 1 },
    { code: 'budget_3', name: 'Budget Keeper', description: 'Stay under your monthly budget 3 times.', conditionType: 'budget_under_count', conditionValue: 3 },
    { code: 'budget_6', name: 'Budget Master', description: 'Stay under your monthly budget 6 times.', conditionType: 'budget_under_count', conditionValue: 6 },
    { code: 'budget_12', name: 'Budget Legend', description: 'Stay under your monthly budget 12 times.', conditionType: 'budget_under_count', conditionValue: 12 },
    // Piggy bank milestones
    { code: 'piggy_first', name: 'First Piggy', description: 'Create your first piggy bank.', conditionType: 'piggy_bank_count', conditionValue: 1 },
    { code: 'piggy_3', name: 'Saver', description: 'Have 3 active piggy banks.', conditionType: 'piggy_bank_count', conditionValue: 3 },
    { code: 'piggy_funded_10', name: 'Diligent Saver', description: 'Fund piggy banks 10 times total.', conditionType: 'piggy_bank_fund_count', conditionValue: 10 },
    // Savings milestones
    { code: 'savings_1000', name: 'First Thousand', description: 'Accumulate €1,000 in Part C all-time.', conditionType: 'part_c_all_time_cents', conditionValue: 100000 },
    { code: 'savings_5000', name: 'Emergency Ready', description: 'Accumulate €5,000 in Part C all-time.', conditionType: 'part_c_all_time_cents', conditionValue: 500000 },
    // XP / Level milestones
    { code: 'level_5', name: 'Rising Star', description: 'Reach level 5.', conditionType: 'level', conditionValue: 5 },
    { code: 'level_10', name: 'Finance Veteran', description: 'Reach level 10.', conditionType: 'level', conditionValue: 10 },
    { code: 'level_20', name: 'Finance Legend', description: 'Reach level 20.', conditionType: 'level', conditionValue: 20 },
  ];

  for (const a of achievements) {
    await db.execAsync(`
      INSERT OR IGNORE INTO achievements (code, name, description, condition_type, condition_value, is_unlocked)
      VALUES ('${a.code}', '${a.name.replace(/'/g, "''")}', '${a.description.replace(/'/g, "''")}', '${a.conditionType}', ${a.conditionValue}, 0);
    `);
  }
}
