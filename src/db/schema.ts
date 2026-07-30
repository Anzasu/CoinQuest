import { sqliteTable, text, integer, real } from 'drizzle-orm/sqlite-core';

// All monetary amounts are stored as integers (cents).
// Display layer converts to €X.XXX,XX format.

export const users = sqliteTable('users', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  name: text('name').notNull().default('Me'),
  currency: text('currency').notNull().default('EUR'),
  createdAt: text('created_at').notNull(),
});

// Recurring bill template (applied each month)
export const billTemplates = sqliteTable('bill_templates', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  name: text('name').notNull(),
  amountCents: integer('amount_cents').notNull(),
  isActive: integer('is_active', { mode: 'boolean' }).notNull().default(true),
  sortOrder: integer('sort_order').notNull().default(0),
  createdAt: text('created_at').notNull(),
});

// One finance month. Bills are deducted first; remaining is split A/B/C/D.
export const monthlyPeriods = sqliteTable('monthly_periods', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  month: integer('month').notNull(), // 1–12
  year: integer('year').notNull(),
  status: text('status', { enum: ['open', 'closed'] }).notNull().default('open'),
  salaryAmountCents: integer('salary_amount_cents').notNull().default(0),
  totalBillsAmountCents: integer('total_bills_amount_cents').notNull().default(0),
  remainingAfterBillsCents: integer('remaining_after_bills_cents').notNull().default(0),
  partAAmountCents: integer('part_a_amount_cents').notNull().default(0),
  partBAmountCents: integer('part_b_amount_cents').notNull().default(0),
  partCAmountCents: integer('part_c_amount_cents').notNull().default(0),
  partDAmountCents: integer('part_d_amount_cents').notNull().default(0),
  donationGoalAmountCents: integer('donation_goal_amount_cents').notNull().default(0),
  donationCompleted: integer('donation_completed', { mode: 'boolean' }).notNull().default(false),
  donationCompletedAt: text('donation_completed_at'),
  monthlyBudgetLimitCents: integer('monthly_budget_limit_cents'),
  monthlySpentCents: integer('monthly_spent_cents').notNull().default(0),
  monthlySpentFromPiggyBanksCents: integer('monthly_spent_from_piggy_banks_cents').notNull().default(0),
  notes: text('notes'),
  createdAt: text('created_at').notNull(),
  closedAt: text('closed_at'),
});

// Each month, one bill instance per bill template is created (allows per-month overrides)
export const monthlyBills = sqliteTable('monthly_bills', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  periodId: integer('period_id').notNull().references(() => monthlyPeriods.id),
  templateId: integer('template_id').references(() => billTemplates.id), // null = manual one-off
  name: text('name').notNull(),
  amountCents: integer('amount_cents').notNull(),
  isPaid: integer('is_paid', { mode: 'boolean' }).notNull().default(true),
  createdAt: text('created_at').notNull(),
});

// One ledger entry per part per month
export const ledgerParts = sqliteTable('ledger_parts', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  periodId: integer('period_id').notNull().references(() => monthlyPeriods.id),
  partType: text('part_type', { enum: ['A', 'B', 'C', 'D'] }).notNull(),
  startingAmountCents: integer('starting_amount_cents').notNull().default(0),
  currentBalanceCents: integer('current_balance_cents').notNull().default(0),
  monthlyTotalCents: integer('monthly_total_cents').notNull().default(0),
  yearlyTotalCents: integer('yearly_total_cents').notNull().default(0),
  allTimeTotalCents: integer('all_time_total_cents').notNull().default(0),
  transferredOutAmountCents: integer('transferred_out_amount_cents').notNull().default(0),
  withdrawnCashAmountCents: integer('withdrawn_cash_amount_cents').notNull().default(0),
  spentAmountCents: integer('spent_amount_cents').notNull().default(0),
});

// One-time historical import: seeds A–D all-time totals from pre-app history.
// Does NOT create monthly transactions, does NOT affect piggy banks or donations.
export const legacyPartImports = sqliteTable('legacy_part_imports', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  partType: text('part_type', { enum: ['A', 'B', 'C', 'D'] }).notNull(),
  amountCents: integer('amount_cents').notNull(),
  dateImported: text('date_imported').notNull(),
  note: text('note'),
  createdAt: text('created_at').notNull(),
  countsTowardAllTimeTotal: integer('counts_toward_all_time_total', { mode: 'boolean' }).notNull().default(true),
});

// External income (refunds, gifts, side income) → goes directly to Part D
export const externalIncome = sqliteTable('external_income', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  periodId: integer('period_id').notNull().references(() => monthlyPeriods.id),
  amountCents: integer('amount_cents').notNull(),
  type: text('type', { enum: ['refund', 'gift', 'sideIncome', 'other'] }).notNull(),
  date: text('date').notNull(),
  note: text('note'),
});

// Normal expense — always from Part D
export const expenses = sqliteTable('expenses', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  periodId: integer('period_id').notNull().references(() => monthlyPeriods.id),
  amountCents: integer('amount_cents').notNull(),
  date: text('date').notNull(),
  category: text('category').notNull(),
  paymentMethod: text('payment_method', { enum: ['cash', 'card'] }).notNull(),
  note: text('note'),
  countsTowardSpending: integer('counts_toward_spending', { mode: 'boolean' }).notNull().default(true),
  createdAt: text('created_at').notNull(),
});

// Transfer: movement of money that is not a normal expense
// Types: AtoExternal, BtoExternal, ACashWithdrawal, BCashWithdrawal, CCashWithdrawal, DCashWithdrawal, DtoPiggyBank
export const transfers = sqliteTable('transfers', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  periodId: integer('period_id').notNull().references(() => monthlyPeriods.id),
  amountCents: integer('amount_cents').notNull(),
  date: text('date').notNull(),
  transferType: text('transfer_type', {
    enum: ['AtoExternal', 'BtoExternal', 'ACashWithdrawal', 'BCashWithdrawal', 'CCashWithdrawal', 'DCashWithdrawal', 'DtoPiggyBank'],
  }).notNull(),
  sourcePart: text('source_part', { enum: ['A', 'B', 'C', 'D'] }).notNull(),
  piggyBankId: integer('piggy_bank_id').references(() => piggyBanks.id), // only for DtoPiggyBank
  note: text('note'),
  createdAt: text('created_at').notNull(),
});

// Custom savings buckets — funded only from Part D, tracked all-time
export const piggyBanks = sqliteTable('piggy_banks', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  name: text('name').notNull(),
  openingCashBalanceCents: integer('opening_cash_balance_cents').notNull().default(0),
  totalAddedAllTimeCents: integer('total_added_all_time_cents').notNull().default(0),
  totalRemovedAllTimeCents: integer('total_removed_all_time_cents').notNull().default(0),
  totalSpentAllTimeCents: integer('total_spent_all_time_cents').notNull().default(0),
  balanceOnAccountCents: integer('balance_on_account_cents').notNull().default(0),
  balanceCashCents: integer('balance_cash_cents').notNull().default(0),
  isArchived: integer('is_archived', { mode: 'boolean' }).notNull().default(false),
  createdAt: text('created_at').notNull(),
});

// Movements into or out of a piggy bank
export const piggyBankTransactions = sqliteTable('piggy_bank_transactions', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  piggyBankId: integer('piggy_bank_id').notNull().references(() => piggyBanks.id),
  date: text('date').notNull(),
  amountCents: integer('amount_cents').notNull(),
  type: text('type', { enum: ['add', 'remove', 'spend'] }).notNull(),
  balanceType: text('balance_type', { enum: ['account', 'cash'] }).notNull().default('account'),
  note: text('note'),
  linkedExpenseId: integer('linked_expense_id').references(() => expenses.id),
  createdAt: text('created_at').notNull(),
});

// Monthly donation record — 25% of Part D before spending
export const donationRecords = sqliteTable('donation_records', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  periodId: integer('period_id').notNull().references(() => monthlyPeriods.id),
  requiredAmountCents: integer('required_amount_cents').notNull(),
  completedAmountCents: integer('completed_amount_cents').notNull().default(0),
  status: text('status', { enum: ['pending', 'completed', 'missed'] }).notNull().default('pending'),
  completedAt: text('completed_at'),
});

// Budget: overall or per-category, per month
export const budgets = sqliteTable('budgets', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  periodId: integer('period_id').notNull().references(() => monthlyPeriods.id),
  scope: text('scope', { enum: ['overall', 'category'] }).notNull(),
  category: text('category'), // null for overall scope
  limitAmountCents: integer('limit_amount_cents').notNull(),
  spentAmountCents: integer('spent_amount_cents').notNull().default(0),
  status: text('status', { enum: ['under', 'over'] }).notNull().default('under'),
  createdAt: text('created_at').notNull(),
});

// App settings (singleton row, id=1)
export const appSettings = sqliteTable('app_settings', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  theme: text('theme', {
    enum: ['dark', 'light', 'babyPink', 'lightBrown', 'lightBlue', 'forestGreen'],
  }).notNull().default('lightBrown'),
  userName: text('user_name').notNull().default('Me'),
  createdAt: text('created_at').notNull(),
  updatedAt: text('updated_at').notNull(),
});
