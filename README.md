# CoinQuest

A manual, gamified personal finance tracker for Android. Built entirely offline — no bank connection, no cloud sync.

> This project is an experiment in using [Claude Code](https://claude.ai/code) to build something I actually need. The app reflects my personal money workflow, and the codebase was designed and implemented through an iterative conversation with Claude Code.

---

## What it does

Each month follows a fixed workflow:

1. **Enter salary** — net salary for the month.
2. **Deduct bills** — fixed recurring bills are subtracted first.
3. **Split the remainder** into four equal parts (25% each), with extra cents going to Part A first, then B.
4. **Track spending, saving, and giving** across the four parts for the rest of the month.

### The four parts

| Part | Role |
|------|------|
| **A** | Money held for someone else (tracked, not yours to spend) |
| **B** | Money held for someone else (tracked, not yours to spend) |
| **C** | Emergency fund — protected reserve, cash withdrawals only |
| **D** | General spending pot — expenses, piggy banks, donations |

### Other features

- **Expenses** — manually logged with category, date, payment method (cash or card), and optional note. 20 built-in categories including Zakat, Donations, and Other.
- **External income** — refunds, gifts, and side income go directly into Part D without being split.
- **Piggy banks** — named savings buckets funded from Part D. Track on-account and cash balances separately. Opening cash balance can be imported without deducting from Part D.
- **Monthly donation goal** — 25% of Part D, locked at month start. Manually confirmed when done.
- **Budgets** — one overall monthly budget plus optional per-category budgets.
- **Legacy import** — seed historical all-time totals for Parts A–D from before the app existed, without creating fake transactions.
- **Month close/reopen** — freeze a month's summaries; reopen later for corrections.
- **XP and leveling** — earned only by completing rules (donation, budget, piggy bank use). Dynamic level thresholds: each level costs more XP than the last.
- **Achievements** — 16 badges for donation streaks, budget discipline, savings milestones, and levels.
- **6 themes** — Dark, Light, Baby Pink, Sand, Sky Blue, Forest Green.

---

## Tech stack

| Layer | Choice |
|-------|--------|
| Framework | Expo 52 (React Native) |
| Database | Expo SQLite + Drizzle ORM |
| UI | React Native Paper (Material Design 3) |
| Routing | Expo Router v4 |
| State | Zustand |
| Language | TypeScript |

Fully offline. All data lives in a local SQLite file on the device.

---

## Project structure

```
app/              Expo Router screens (tabs + modals)
  (tabs)/         Dashboard, Parts, Piggy Banks, More
  month/          New month wizard, month detail, period list
  expenses/       Add expense
  transfers/      Add transfer / piggy bank funding
  piggy/          Piggy bank detail, new piggy bank
  income/         Add external income
  legacy/         Historical A–D import
  bills/          Bill template management
  budgets/        Budget list and add

src/
  db/             Drizzle schema + SQL migrations
  hooks/          One hook per domain (periods, expenses, transfers, etc.)
  lib/            Pure business logic (money, xp, categories, dates, achievements)
  components/     Shared UI components
  theme/          6 theme definitions
  stores/         Zustand stores (settings, db ready state)

__tests__/        66 unit tests for financial logic
```

---

## Money logic

All amounts are stored and computed as **integer cents** — no floating-point arithmetic is used anywhere near money.

**Salary split rounding rule** (from spec):
```
remaining = salary - bills
base = floor(remaining / 4)
extra = remaining % 4   // 0, 1, 2, or 3

partA = base + (extra >= 1 ? 1 : 0)
partB = base + (extra >= 2 ? 1 : 0)
partC = base + (extra >= 3 ? 1 : 0)
partD = base
```
Extra cents always go to A first, then B, then C. The split always sums back to exactly `remaining`.

**Donation goal:** `floor(partD / 4)`, locked when the month is started.

**XP level thresholds:** `threshold(N) = 100 * (N*(N+1)/2 - 1)` — each level costs 100 more XP than the previous one.

---

## Running tests

```bash
npm test
```

Tests cover: salary splitting (all 4 rounding cases), bill deduction, donation goal calculation, euro input parsing, cent formatting, budget status, XP thresholds, level calculation, and achievement unlocking.

---

## Building the APK

```bash
# One-time setup
npm install -g eas-cli
eas login

# Build a sideloadable APK
eas build --platform android --profile preview
```

The APK can be transferred to any Android 11+ device and installed directly (no Play Store needed).

---

## Currency

Euro only. Display format: `€1.234,56` (dot as thousands separator, comma as decimal — European standard).
