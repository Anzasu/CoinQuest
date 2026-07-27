---
name: coinquest-project-overview
description: Stack, architecture, and key decisions for CoinQuest — offline Android finance tracker
metadata:
  type: project
---

# CoinQuest — Project Overview

## Stack
- **Expo 52 / React Native** — Android-only, offline APK (sideloaded)
- **Expo SQLite + Drizzle ORM** — local SQLite database, no network
- **React Native Paper** — Material Design 3 UI components
- **Expo Router v4** — file-based routing with tabs
- **Zustand** — settings/theme store
- **date-fns** — date formatting

## Architecture
- `src/db/schema.ts` — Drizzle schema (all amounts in cents)
- `src/db/migrations.ts` — SQL migrations run on app start
- `src/lib/money.ts` — core financial logic (splitSalary, etc.)
- `src/lib/xp.ts` — XP/leveling formulas
- `src/hooks/` — one hook per domain (usePeriods, useExpenses, etc.)
- `src/theme/themes.ts` — 6 themes (dark, light, babyPink, lightBrown, lightBlue, forestGreen)
- `app/(tabs)/` — 4 main tabs: Dashboard, Parts, Piggy Banks, More

## Key Decisions
- All amounts stored as integer cents (no floats ever)
- European number format: €1.234,56
- No authentication — single user, opens directly to dashboard
- Bills: named recurring templates that auto-fill on new month
- Month start: manual "Start New Month" button
- Salary split: A gets extra cents first, then B, then C (for 3-cent remainders)
- Donation goal: floor(partD / 4) — set at month start, never changes even if Part D changes

## Build
- APK: `eas build --platform android --profile preview`
- Tests: `npm test` (66 tests, pure logic, no React Native)

**Why:** User wants an offline Android finance app following a specific Islamic/personal money workflow (salary split, Zakat donations, emergency fund).
**How to apply:** Any changes must preserve the money logic invariants tested in `__tests__/money.test.ts`.
