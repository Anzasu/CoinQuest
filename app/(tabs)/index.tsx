import React, { useEffect, useState, useCallback } from 'react';
import { View, ScrollView, StyleSheet, RefreshControl } from 'react-native';
import { Text, FAB, Surface } from 'react-native-paper';
import { useRouter } from 'expo-router';
import { useFocusEffect } from '@react-navigation/native';
import { useAppTheme } from '@/hooks/useAppTheme';
import { usePeriods } from '@/hooks/usePeriods';
import { useDonation } from '@/hooks/useDonation';
import { useGamification } from '@/hooks/useGamification';
import { useSettingsStore } from '@/stores/settingsStore';
import { SummaryCard } from '@/components/SummaryCard';
import { DonationCard } from '@/components/DonationCard';
import { BudgetCard } from '@/components/BudgetCard';
import { XpBar } from '@/components/XpBar';
import { formatMonthYear } from '@/lib/dates';
import { db } from '@/db';
import { piggyBanks, budgets, ledgerParts } from '@/db/schema';
import { eq, and, sum as dbSum } from 'drizzle-orm';
import type { Period } from '@/hooks/usePeriods';
import type { DonationRecord } from '@/hooks/useDonation';

export default function DashboardScreen() {
  const theme = useAppTheme();
  const router = useRouter();
  const userName = useSettingsStore((s) => s.userName);
  const { getAllPeriods, getLedgerParts } = usePeriods();
  const { getDonationRecord, completeDonation, undoDonation } = useDonation();
  const { getGamificationStats } = useGamification();

  const [activePeriod, setActivePeriod] = useState<Period | null>(null);
  const [partBalances, setPartBalances] = useState<Record<string, number>>({});
  const [donationRecord, setDonationRecord] = useState<DonationRecord | undefined>();
  const [overallBudget, setOverallBudget] = useState<{ limit: number | null; spent: number }>({ limit: null, spent: 0 });
  const [piggyTotal, setPiggyTotal] = useState<{ balance: number; spentThisMonth: number }>({ balance: 0, spentThisMonth: 0 });
  const [gamification, setGamification] = useState<{ totalXp: number; level: number; progress: number; xpToNextLevel: number } | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    const periods = await getAllPeriods();
    const open = periods.find((p) => p.status === 'open') ?? periods[0] ?? null;
    setActivePeriod(open);

    if (open) {
      const parts = await getLedgerParts(open.id);
      const balances: Record<string, number> = {};
      for (const p of parts) {
        balances[p.partType] = p.currentBalanceCents;
      }
      setPartBalances(balances);

      const donation = await getDonationRecord(open.id);
      setDonationRecord(donation);

      const budget = await db
        .select()
        .from(budgets)
        .where(and(eq(budgets.periodId, open.id), eq(budgets.scope, 'overall')));
      setOverallBudget({
        limit: budget[0]?.limitAmountCents ?? null,
        spent: open.monthlySpentCents,
      });
    }

    // Piggy banks total balance
    const pbs = await db.select().from(piggyBanks);
    const activePbs = pbs.filter((p) => !p.isArchived);
    const totalBalance = activePbs.reduce(
      (s, p) => s + p.balanceOnAccountCents + p.balanceCashCents,
      0,
    );
    setPiggyTotal({
      balance: totalBalance,
      spentThisMonth: open?.monthlySpentFromPiggyBanksCents ?? 0,
    });

    const stats = await getGamificationStats();
    setGamification({
      totalXp: stats.totalXp,
      level: stats.level,
      progress: stats.progress,
      xpToNextLevel: stats.xpToNextLevel,
    });
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  async function handleRefresh() {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  }

  async function handleDonationComplete() {
    if (!activePeriod) return;
    await completeDonation(activePeriod.id);
    await load();
  }

  async function handleDonationUndo() {
    if (!activePeriod) return;
    await undoDonation(activePeriod.id);
    await load();
  }

  const hasPeriod = activePeriod != null;

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <ScrollView
        contentContainerStyle={styles.scroll}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />}
      >
        {/* Header */}
        <View style={styles.header}>
          <View>
            <Text style={[styles.greeting, { color: theme.colors.onBackground + '88' }]}>
              Welcome back,
            </Text>
            <Text style={[styles.name, { color: theme.colors.onBackground }]}>{userName}</Text>
          </View>
          {activePeriod && (
            <Surface style={[styles.monthBadge, { backgroundColor: theme.colors.primary + '22' }]}>
              <Text style={[styles.monthText, { color: theme.colors.primary }]}>
                {formatMonthYear(activePeriod.month, activePeriod.year)}
              </Text>
            </Surface>
          )}
        </View>

        {/* XP Bar */}
        {gamification && (
          <XpBar
            totalXp={gamification.totalXp}
            level={gamification.level}
            progress={gamification.progress}
            xpToNext={gamification.xpToNextLevel}
          />
        )}

        {!hasPeriod ? (
          <Surface style={[styles.noMonth, { backgroundColor: theme.colors.surface, borderColor: theme.custom.cardBorder }]}>
            <Text style={[styles.noMonthTitle, { color: theme.colors.onSurface }]}>No active month</Text>
            <Text style={[styles.noMonthSub, { color: theme.colors.onSurface + '77' }]}>
              Tap the + button to start a new month and enter your salary.
            </Text>
          </Surface>
        ) : (
          <>
            {/* Part cards */}
            <Text style={[styles.section, { color: theme.colors.onBackground + '88' }]}>PARTS</Text>

            <SummaryCard
              title="Part A — Third Party"
              amount={partBalances['A'] ?? 0}
              accentColor={theme.custom.partA}
              subtitle={`This month: +€${((activePeriod.partAAmountCents ?? 0) / 100).toFixed(2).replace('.', ',')}`}
              onPress={() => router.push({ pathname: '/month/[id]', params: { id: activePeriod.id, tab: 'A' } })}
            />
            <SummaryCard
              title="Part B — Third Party"
              amount={partBalances['B'] ?? 0}
              accentColor={theme.custom.partB}
              subtitle={`This month: +€${((activePeriod.partBAmountCents ?? 0) / 100).toFixed(2).replace('.', ',')}`}
              onPress={() => router.push({ pathname: '/month/[id]', params: { id: activePeriod.id, tab: 'B' } })}
            />
            <SummaryCard
              title="Part C — Emergency Fund"
              amount={partBalances['C'] ?? 0}
              accentColor={theme.custom.partC}
              subtitle={`This month: +€${((activePeriod.partCAmountCents ?? 0) / 100).toFixed(2).replace('.', ',')}`}
              onPress={() => router.push({ pathname: '/month/[id]', params: { id: activePeriod.id, tab: 'C' } })}
            />
            <SummaryCard
              title="Part D — Spending"
              amount={partBalances['D'] ?? 0}
              accentColor={theme.custom.partD}
              subtitle={`Spent: €${(activePeriod.monthlySpentCents / 100).toFixed(2).replace('.', ',')} this month`}
              onPress={() => router.push({ pathname: '/month/[id]', params: { id: activePeriod.id, tab: 'D' } })}
            />

            {/* Budget */}
            <Text style={[styles.section, { color: theme.colors.onBackground + '88' }]}>BUDGET</Text>
            <BudgetCard
              limitCents={overallBudget.limit}
              spentCents={overallBudget.spent}
              onPress={() => router.push({ pathname: '/month/[id]', params: { id: activePeriod.id, tab: 'budget' } })}
            />

            {/* Donation */}
            <Text style={[styles.section, { color: theme.colors.onBackground + '88' }]}>DONATION</Text>
            <DonationCard
              record={donationRecord}
              onComplete={handleDonationComplete}
              onUndo={handleDonationUndo}
              onPress={() => router.push({ pathname: '/month/[id]', params: { id: activePeriod.id, tab: 'donation' } })}
            />

            {/* Piggy Banks */}
            <Text style={[styles.section, { color: theme.colors.onBackground + '88' }]}>PIGGY BANKS</Text>
            <SummaryCard
              title="Piggy Banks — Total Balance"
              amount={piggyTotal.balance}
              accentColor={theme.colors.secondary}
              subtitle={`Spent from piggy banks this month: €${(piggyTotal.spentThisMonth / 100).toFixed(2).replace('.', ',')}`}
              onPress={() => router.push('/(tabs)/piggybanks')}
            />
          </>
        )}

        <View style={{ height: 80 }} />
      </ScrollView>

      {/* FAB for new month or add expense */}
      {!hasPeriod ? (
        <FAB
          icon="plus"
          label="Start Month"
          style={[styles.fab, { backgroundColor: theme.colors.primary }]}
          color="#fff"
          onPress={() => router.push('/month/new')}
        />
      ) : (
        <FAB
          icon="plus"
          style={[styles.fabSmall, { backgroundColor: theme.colors.primary }]}
          color="#fff"
          onPress={() => router.push('/expenses/add')}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  scroll: { padding: 16, gap: 4 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
    paddingTop: 48,
  },
  greeting: { fontSize: 14 },
  name: { fontSize: 24, fontWeight: '800' },
  monthBadge: { borderRadius: 8, paddingHorizontal: 12, paddingVertical: 6 },
  monthText: { fontSize: 13, fontWeight: '700' },
  section: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1,
    marginTop: 12,
    marginBottom: 4,
  },
  noMonth: {
    borderRadius: 12,
    borderWidth: 1,
    padding: 24,
    alignItems: 'center',
    gap: 8,
    marginTop: 24,
  },
  noMonthTitle: { fontSize: 18, fontWeight: '700' },
  noMonthSub: { fontSize: 14, textAlign: 'center', lineHeight: 22 },
  fab: {
    position: 'absolute',
    right: 16,
    bottom: 80,
  },
  fabSmall: {
    position: 'absolute',
    right: 16,
    bottom: 80,
  },
});
