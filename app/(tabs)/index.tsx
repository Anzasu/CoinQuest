import React, { useEffect, useState, useCallback } from 'react';
import { View, ScrollView, StyleSheet, RefreshControl, Dimensions, TouchableOpacity } from 'react-native';
import { Text, FAB, Surface, Portal } from 'react-native-paper';
import { useRouter } from 'expo-router';
import { useFocusEffect } from '@react-navigation/native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useAppTheme } from '@/hooks/useAppTheme';
import { usePeriods } from '@/hooks/usePeriods';
import { useDonation } from '@/hooks/useDonation';
import { useGamification } from '@/hooks/useGamification';
import { useLegacyImport } from '@/hooks/useLegacyImport';
import { useSettingsStore } from '@/stores/settingsStore';
import { XpBar } from '@/components/XpBar';
import { DonationCard } from '@/components/DonationCard';
import { formatCents } from '@/lib/money';
import { formatMonthYear } from '@/lib/dates';
import { db } from '@/db';
import { piggyBanks, monthlyPeriods, ledgerParts } from '@/db/schema';
import { desc, eq } from 'drizzle-orm';
import type { Period } from '@/hooks/usePeriods';
import type { DonationRecord } from '@/hooks/useDonation';

const SCREEN_W = Dimensions.get('window').width;

const PART_LABELS: Record<string, string> = {
  A: 'B&M Savings',
  B: 'B&M Expenses',
  C: 'Emergency Fund',
  D: 'Spending',
};

export default function DashboardScreen() {
  const theme = useAppTheme();
  const router = useRouter();
  const userName = useSettingsStore((s) => s.userName);
  const { getAllPeriods, getLedgerParts } = usePeriods();
  const { getDonationRecord, completeDonation, undoDonation } = useDonation();
  const { getGamificationStats } = useGamification();
  const { getLegacyTotals } = useLegacyImport();

  const [activePeriod, setActivePeriod] = useState<Period | null>(null);
  const [donationRecord, setDonationRecord] = useState<DonationRecord | undefined>();
  const [gamification, setGamification] = useState<{ totalXp: number; level: number; progress: number; xpToNextLevel: number } | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [fabOpen, setFabOpen] = useState(false);

  // All-time per-part totals: sum of monthlyTotalCents across all periods + legacy
  const [allTimeTotals, setAllTimeTotals] = useState<Record<string, number>>({ A: 0, B: 0, C: 0, D: 0 });
  // Piggy bank totals
  const [piggyTotal, setPiggyTotal] = useState(0);
  // Monthly spending for the current year (last 12 months)
  const [monthlySpending, setMonthlySpending] = useState<{ label: string; cents: number }[]>([]);
  // Current Spending part: on-account vs cash view
  const [spendingView, setSpendingView] = useState<'month' | 'year'>('month');
  const [spendingOnAccount, setSpendingOnAccount] = useState(0);
  const [spendingCash, setSpendingCash] = useState(0);
  const [yearSpendingOnAccount, setYearSpendingOnAccount] = useState(0);
  const [yearSpendingCash, setYearSpendingCash] = useState(0);

  const load = useCallback(async () => {
    const periods = await getAllPeriods();
    const open = periods.find((p) => p.status === 'open') ?? periods[0] ?? null;
    setActivePeriod(open);

    if (open) {
      const donation = await getDonationRecord(open.id);
      setDonationRecord(donation);

      // Current month Spending part cash/account split
      const dParts = await getLedgerParts(open.id);
      const dPart = dParts.find((p) => p.partType === 'D');
      setSpendingOnAccount(dPart?.currentBalanceCents ?? 0);
      setSpendingCash(dPart?.withdrawnCashAmountCents ?? 0);
    }

    // All-time totals: sum monthly totals across all periods + legacy
    const allParts = await db.select().from(ledgerParts);
    const totals: Record<string, number> = { A: 0, B: 0, C: 0, D: 0 };
    for (const p of allParts) {
      totals[p.partType] = (totals[p.partType] ?? 0) + p.monthlyTotalCents;
    }
    const legacy = await getLegacyTotals();
    for (const k of ['A', 'B', 'C', 'D'] as const) {
      totals[k] = (totals[k] ?? 0) + (legacy[k] ?? 0);
    }
    setAllTimeTotals(totals);

    // Year spending: sum monthly cash/account across this calendar year
    const thisYear = new Date().getFullYear();
    const yearPeriods = periods.filter((p) => p.year === thisYear);
    let yAccount = 0, yCash = 0;
    for (const p of yearPeriods) {
      const pts = await getLedgerParts(p.id);
      const d = pts.find((x) => x.partType === 'D');
      if (d) {
        yAccount += d.currentBalanceCents;
        yCash += d.withdrawnCashAmountCents;
      }
    }
    setYearSpendingOnAccount(yAccount);
    setYearSpendingCash(yCash);

    // Monthly spending bar chart: last 12 periods
    const last12 = periods.slice(0, 12).reverse();
    setMonthlySpending(
      last12.map((p) => ({
        label: `${p.month}/${String(p.year).slice(2)}`,
        cents: p.monthlySpentCents,
      })),
    );

    // Piggy banks total
    const pbs = await db.select().from(piggyBanks);
    const active = pbs.filter((p) => !p.isArchived);
    setPiggyTotal(active.reduce((s, p) => s + p.balanceOnAccountCents + p.balanceCashCents, 0));

    const stats = await getGamificationStats();
    setGamification({ totalXp: stats.totalXp, level: stats.level, progress: stats.progress, xpToNextLevel: stats.xpToNextLevel });
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

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
  const maxSpending = Math.max(...monthlySpending.map((m) => m.cents), 1);

  const spendCurrent = spendingView === 'month'
    ? { account: spendingOnAccount, cash: spendingCash }
    : { account: yearSpendingOnAccount, cash: yearSpendingCash };

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <ScrollView
        contentContainerStyle={styles.scroll}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />}
      >
        {/* Header */}
        <View style={styles.header}>
          <View>
            <Text style={[styles.greeting, { color: theme.colors.onBackground + '88' }]}>Welcome back,</Text>
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
            {/* All-time part totals */}
            <Text style={[styles.section, { color: theme.colors.onBackground + '88' }]}>ALL-TIME TOTALS</Text>
            <Surface style={[styles.card, { backgroundColor: theme.colors.surface, borderColor: theme.custom.cardBorder }]}>
              {(['A', 'B', 'C', 'D'] as const).map((key) => (
                <View key={key} style={styles.allTimeRow}>
                  <View style={[styles.partDot, { backgroundColor: theme.custom[`part${key}` as keyof typeof theme.custom] as string }]} />
                  <Text style={[styles.allTimeLabel, { color: theme.colors.onSurface + '99' }]}>{PART_LABELS[key]}</Text>
                  <Text style={[styles.allTimeValue, { color: theme.colors.onSurface }]}>{formatCents(allTimeTotals[key] ?? 0)}</Text>
                </View>
              ))}
              <View style={[styles.divider, { backgroundColor: theme.custom.cardBorder }]} />
              <View style={styles.allTimeRow}>
                <View style={[styles.partDot, { backgroundColor: theme.colors.secondary }]} />
                <Text style={[styles.allTimeLabel, { color: theme.colors.onSurface + '99' }]}>Piggy Banks</Text>
                <Text style={[styles.allTimeValue, { color: theme.colors.secondary }]}>{formatCents(piggyTotal)}</Text>
              </View>
            </Surface>

            {/* Spending: cash vs account */}
            <Text style={[styles.section, { color: theme.colors.onBackground + '88' }]}>SPENDING BREAKDOWN</Text>
            <Surface style={[styles.card, { backgroundColor: theme.colors.surface, borderColor: theme.custom.cardBorder }]}>
              <View style={styles.switchRow}>
                <TouchableOpacity
                  onPress={() => setSpendingView('month')}
                  style={[styles.switchBtn, spendingView === 'month' && { backgroundColor: theme.colors.primary + '22' }]}
                >
                  <Text style={{ fontSize: 12, fontWeight: '700', color: spendingView === 'month' ? theme.colors.primary : theme.colors.onSurface + '66' }}>
                    This month
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={() => setSpendingView('year')}
                  style={[styles.switchBtn, spendingView === 'year' && { backgroundColor: theme.colors.primary + '22' }]}
                >
                  <Text style={{ fontSize: 12, fontWeight: '700', color: spendingView === 'year' ? theme.colors.primary : theme.colors.onSurface + '66' }}>
                    This year
                  </Text>
                </TouchableOpacity>
              </View>
              <View style={styles.spendRow}>
                <View style={{ flex: 1, alignItems: 'center' }}>
                  <MaterialCommunityIcons name="credit-card" size={20} color={theme.custom.partD} />
                  <Text style={[styles.spendLabel, { color: theme.colors.onSurface + '77' }]}>On account</Text>
                  <Text style={[styles.spendValue, { color: theme.colors.onSurface }]}>{formatCents(spendCurrent.account)}</Text>
                </View>
                <View style={[styles.vDivider, { backgroundColor: theme.custom.cardBorder }]} />
                <View style={{ flex: 1, alignItems: 'center' }}>
                  <MaterialCommunityIcons name="cash" size={20} color={theme.custom.partD} />
                  <Text style={[styles.spendLabel, { color: theme.colors.onSurface + '77' }]}>Cash withdrawn</Text>
                  <Text style={[styles.spendValue, { color: theme.colors.onSurface }]}>{formatCents(spendCurrent.cash)}</Text>
                </View>
              </View>
            </Surface>

            {/* Monthly spending chart */}
            {monthlySpending.length > 0 && (
              <>
                <Text style={[styles.section, { color: theme.colors.onBackground + '88' }]}>MONTHLY SPENDING</Text>
                <Surface style={[styles.card, { backgroundColor: theme.colors.surface, borderColor: theme.custom.cardBorder }]}>
                  <View style={styles.chartRow}>
                    {monthlySpending.map((m, i) => {
                      const barH = Math.max(4, Math.round((m.cents / maxSpending) * 80));
                      const isActive = activePeriod && m.label === `${activePeriod.month}/${String(activePeriod.year).slice(2)}`;
                      return (
                        <View key={i} style={styles.barCol}>
                          <Text style={[styles.barValue, { color: theme.colors.onSurface + '66' }]}>
                            {m.cents >= 100000 ? `${Math.round(m.cents / 10000) / 10}k` : `${Math.round(m.cents / 100)}`}
                          </Text>
                          <View style={{ flex: 1, justifyContent: 'flex-end' }}>
                            <View style={[styles.bar, { height: barH, backgroundColor: isActive ? theme.custom.partD : theme.custom.partD + '66' }]} />
                          </View>
                          <Text style={[styles.barLabel, { color: theme.colors.onSurface + '55' }]}>{m.label}</Text>
                        </View>
                      );
                    })}
                  </View>
                </Surface>
              </>
            )}

            {/* Donation */}
            <Text style={[styles.section, { color: theme.colors.onBackground + '88' }]}>DONATION</Text>
            <DonationCard
              record={donationRecord}
              onComplete={handleDonationComplete}
              onUndo={handleDonationUndo}
              onPress={() => router.push({ pathname: '/month/[id]', params: { id: activePeriod.id, tab: 'donation' } })}
            />
          </>
        )}

        <View style={{ height: 100 }} />
      </ScrollView>

      {/* FAB */}
      {!hasPeriod ? (
        <FAB
          icon="plus"
          label="Start Month"
          style={[styles.fab, { backgroundColor: theme.colors.primary }]}
          color="#fff"
          onPress={() => router.push('/month/new')}
        />
      ) : (
        <Portal>
          <FAB.Group
            open={fabOpen}
            visible
            icon={fabOpen ? 'close' : 'plus'}
            color="#fff"
            fabStyle={{ backgroundColor: theme.colors.primary, bottom: 80 }}
            onStateChange={({ open }) => setFabOpen(open)}
            actions={[
              {
                icon: 'receipt',
                label: 'Add Expense',
                onPress: () => router.push('/expenses/add'),
                style: { backgroundColor: theme.custom.partD },
                color: '#fff',
              },
              {
                icon: 'cash-minus',
                label: 'Cash Out (Spending)',
                onPress: () => router.push({ pathname: '/transfers/add', params: { periodId: activePeriod.id, preselect: 'DCashWithdrawal' } }),
                style: { backgroundColor: theme.custom.partC },
                color: '#fff',
              },
              {
                icon: 'cash-plus',
                label: 'Extra Income',
                onPress: () => router.push({ pathname: '/income/add', params: { periodId: activePeriod.id } }),
                style: { backgroundColor: theme.custom.income },
                color: '#fff',
              },
            ]}
          />
        </Portal>
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
  section: { fontSize: 11, fontWeight: '700', letterSpacing: 1, marginTop: 12, marginBottom: 4 },
  card: { borderRadius: 12, borderWidth: 1, padding: 16, gap: 10 },
  allTimeRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  partDot: { width: 10, height: 10, borderRadius: 5 },
  allTimeLabel: { flex: 1, fontSize: 14 },
  allTimeValue: { fontSize: 14, fontWeight: '700' },
  divider: { height: 1, marginVertical: 2 },
  switchRow: { flexDirection: 'row', gap: 8, marginBottom: 4 },
  switchBtn: { flex: 1, alignItems: 'center', paddingVertical: 6, borderRadius: 8 },
  spendRow: { flexDirection: 'row', alignItems: 'center' },
  spendLabel: { fontSize: 12, marginTop: 4 },
  spendValue: { fontSize: 16, fontWeight: '700', marginTop: 2 },
  vDivider: { width: 1, height: 60, marginHorizontal: 8 },
  chartRow: { flexDirection: 'row', alignItems: 'flex-end', height: 120, gap: 4 },
  barCol: { flex: 1, alignItems: 'center', height: 120, justifyContent: 'flex-end' },
  barValue: { fontSize: 8, marginBottom: 2 },
  bar: { width: '80%', borderRadius: 3 },
  barLabel: { fontSize: 8, marginTop: 3 },
  noMonth: { borderRadius: 12, borderWidth: 1, padding: 24, alignItems: 'center', gap: 8, marginTop: 24 },
  noMonthTitle: { fontSize: 18, fontWeight: '700' },
  noMonthSub: { fontSize: 14, textAlign: 'center', lineHeight: 22 },
  fab: { position: 'absolute', right: 16, bottom: 80 },
});
