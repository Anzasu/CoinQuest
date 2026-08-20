import * as SQLite from 'expo-sqlite';

// Run all CREATE TABLE statements in order. Safe to re-run (IF NOT EXISTS).
export async function runMigrations(db: SQLite.SQLiteDatabase): Promise<void> {
  await db.execAsync('PRAGMA journal_mode = WAL;');
  await db.execAsync('PRAGMA foreign_keys = ON;');

  await db.execAsync(`CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL DEFAULT 'Me',
    currency TEXT NOT NULL DEFAULT 'EUR',
    created_at TEXT NOT NULL
  );`);

  await db.execAsync(`CREATE TABLE IF NOT EXISTS app_settings (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    theme TEXT NOT NULL DEFAULT 'dark',
    user_name TEXT NOT NULL DEFAULT 'Me',
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );`);

  await db.execAsync(`CREATE TABLE IF NOT EXISTS bill_templates (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    amount_cents INTEGER NOT NULL,
    is_active INTEGER NOT NULL DEFAULT 1,
    sort_order INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL
  );`);

  await db.execAsync(`CREATE TABLE IF NOT EXISTS monthly_periods (
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
    monthly_budget_limit_cents INTEGER,
    monthly_spent_cents INTEGER NOT NULL DEFAULT 0,
    monthly_spent_from_piggy_banks_cents INTEGER NOT NULL DEFAULT 0,
    notes TEXT,
    created_at TEXT NOT NULL,
    closed_at TEXT,
    UNIQUE(month, year)
  );`);

  await db.execAsync(`CREATE TABLE IF NOT EXISTS monthly_bills (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    period_id INTEGER NOT NULL REFERENCES monthly_periods(id),
    template_id INTEGER REFERENCES bill_templates(id),
    name TEXT NOT NULL,
    amount_cents INTEGER NOT NULL,
    is_paid INTEGER NOT NULL DEFAULT 1,
    created_at TEXT NOT NULL
  );`);

  await db.execAsync(`CREATE TABLE IF NOT EXISTS ledger_parts (
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
  );`);

  await db.execAsync(`CREATE TABLE IF NOT EXISTS legacy_part_imports (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    part_type TEXT NOT NULL,
    amount_cents INTEGER NOT NULL,
    date_imported TEXT NOT NULL,
    note TEXT,
    created_at TEXT NOT NULL,
    counts_toward_all_time_total INTEGER NOT NULL DEFAULT 1
  );`);

  await db.execAsync(`CREATE TABLE IF NOT EXISTS external_income (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    period_id INTEGER NOT NULL REFERENCES monthly_periods(id),
    amount_cents INTEGER NOT NULL,
    type TEXT NOT NULL,
    date TEXT NOT NULL,
    note TEXT
  );`);

  await db.execAsync(`CREATE TABLE IF NOT EXISTS expenses (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    period_id INTEGER NOT NULL REFERENCES monthly_periods(id),
    amount_cents INTEGER NOT NULL,
    date TEXT NOT NULL,
    category TEXT NOT NULL,
    payment_method TEXT NOT NULL,
    note TEXT,
    counts_toward_spending INTEGER NOT NULL DEFAULT 1,
    created_at TEXT NOT NULL
  );`);

  await db.execAsync(`CREATE TABLE IF NOT EXISTS piggy_banks (
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
  );`);

  await db.execAsync(`CREATE TABLE IF NOT EXISTS transfers (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    period_id INTEGER NOT NULL REFERENCES monthly_periods(id),
    amount_cents INTEGER NOT NULL,
    date TEXT NOT NULL,
    transfer_type TEXT NOT NULL,
    source_part TEXT NOT NULL,
    piggy_bank_id INTEGER REFERENCES piggy_banks(id),
    note TEXT,
    created_at TEXT NOT NULL
  );`);

  await db.execAsync(`CREATE TABLE IF NOT EXISTS piggy_bank_transactions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    piggy_bank_id INTEGER NOT NULL REFERENCES piggy_banks(id),
    date TEXT NOT NULL,
    amount_cents INTEGER NOT NULL,
    type TEXT NOT NULL,
    balance_type TEXT NOT NULL DEFAULT 'account',
    note TEXT,
    linked_expense_id INTEGER REFERENCES expenses(id),
    created_at TEXT NOT NULL
  );`);

  await db.execAsync(`CREATE TABLE IF NOT EXISTS donation_records (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    period_id INTEGER NOT NULL REFERENCES monthly_periods(id),
    required_amount_cents INTEGER NOT NULL,
    completed_amount_cents INTEGER NOT NULL DEFAULT 0,
    status TEXT NOT NULL DEFAULT 'pending',
    completed_at TEXT
  );`);

  await db.execAsync(`CREATE TABLE IF NOT EXISTS budgets (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    period_id INTEGER NOT NULL REFERENCES monthly_periods(id),
    scope TEXT NOT NULL,
    category TEXT,
    limit_amount_cents INTEGER NOT NULL,
    spent_amount_cents INTEGER NOT NULL DEFAULT 0,
    status TEXT NOT NULL DEFAULT 'under',
    created_at TEXT NOT NULL
  );`);

  await db.execAsync(`CREATE TABLE IF NOT EXISTS app_migrations (
    name TEXT PRIMARY KEY,
    applied_at TEXT NOT NULL
  );`);

  const donationReservation = await db.getFirstAsync<{ name: string }>(
    `SELECT name FROM app_migrations WHERE name = 'reserve_donation_from_spending'`,
  );
  if (!donationReservation) {
    await db.withTransactionAsync(async () => {
      await db.execAsync(`
        UPDATE monthly_periods
        SET
          part_d_amount_cents = MAX(0, part_d_amount_cents - donation_goal_amount_cents),
          monthly_spent_cents = MAX(
            0,
            monthly_spent_cents - CASE WHEN donation_completed = 1 THEN donation_goal_amount_cents ELSE 0 END
          )
        WHERE donation_goal_amount_cents > 0;

        UPDATE ledger_parts
        SET
          starting_amount_cents = MAX(
            0,
            starting_amount_cents - COALESCE((
              SELECT required_amount_cents FROM donation_records
              WHERE donation_records.period_id = ledger_parts.period_id
            ), 0)
          ),
          monthly_total_cents = MAX(
            0,
            monthly_total_cents - COALESCE((
              SELECT required_amount_cents FROM donation_records
              WHERE donation_records.period_id = ledger_parts.period_id
            ), 0)
          ),
          current_balance_cents = current_balance_cents - CASE
            WHEN COALESCE((
              SELECT status FROM donation_records
              WHERE donation_records.period_id = ledger_parts.period_id
            ), 'pending') = 'completed' THEN 0
            ELSE COALESCE((
              SELECT required_amount_cents FROM donation_records
              WHERE donation_records.period_id = ledger_parts.period_id
            ), 0)
          END
        WHERE part_type = 'D';

        INSERT INTO app_migrations (name, applied_at)
        VALUES ('reserve_donation_from_spending', datetime('now'));
      `);
    });
  }

  // Seed app_settings singleton if not present
  await db.execAsync(`INSERT OR IGNORE INTO app_settings (id, theme, user_name, created_at, updated_at)
    VALUES (1, 'lightBrown', 'Me', datetime('now'), datetime('now'));`);
}
