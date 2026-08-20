import React, { useEffect, useState, useCallback } from 'react';
import { View, ScrollView, StyleSheet, RefreshControl, Dimensions, TouchableOpacity, Alert } from 'react-native';
import { Text, FAB, Surface, Portal } from 'react-native-paper';
import { useRouter } from 'expo-router';
import { useFocusEffect } from '@react-navigation/native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useAppTheme } from '@/hooks/useAppTheme';
import { usePeriods } from '@/hooks/usePeriods';
import { useDonation } from '@/hooks/useDonation';
import { DonationCard } from '@/components/DonationCard';
import { formatCents } from '@/lib/money';
import { formatMonthYear } from '@/lib/dates';
import { eq } from 'drizzle-orm';
import { db } from '@/db';
import { piggyBanks, expenses as expensesTable } from '@/db/schema';
import type { Period } from '@/hooks/usePeriods';
import type { DonationRecord } from '@/hooks/useDonation';
import { getPartBalanceSummaries } from '@/lib/partBalances';

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
  const { getAllPeriods, getLedgerParts } = usePeriods();
  const { getDonationRecord, completeDonation, undoDonation } = useDonation();

  const [activePeriod, setActivePeriod] = useState<Period | null>(null);
  const [donationRecord, setDonationRecord] = useState<DonationRecord | undefined>();
  const [refreshing, setRefreshing] = useState(false);

  // All-time remaining per part: all income minus all outflows.
  const [allTimeTotals, setAllTimeTotals] = useState<Record<string, number>>({ A: 0, B: 0, C: 0, D: 0 });
  // Piggy bank totals
  const [piggyTotal, setPiggyTotal] = useState(0);
  // Monthly spending for the current year (last 12 months)
  const [monthlySpending, setMonthlySpending] = useState<{ label: string; cents: number }[]>([]);
  // Spending breakdown: card vs cash expenses
  const [spendingView, setSpendingView] = useState<'month' | 'year'>('month');
  const [spendingCard, setSpendingCard] = useState(0);
  const [spendingCash, setSpendingCash] = useState(0);
  const [yearSpendingCard, setYearSpendingCard] = useState(0);
  const [yearSpendingCash, setYearSpendingCash] = useState(0);

  const load = useCallback(async () => {
    const periods = await getAllPeriods();
    const now = new Date();
    const curMonth = now.getMonth() + 1;
    const curYear = now.getFullYear();
    const open = periods.find((p) => p.month === curMonth && p.year === curYear)
      ?? periods.find((p) => p.status === 'open')
      ?? periods[0]
      ?? null;
    setActivePeriod(open);

    if (open) {
      const donation = await getDonationRecord(open.id);
      setDonationRecord(donation);

      // Current month: sum expenses by payment method
      const monthExps = await db.select().from(expensesTable).where(eq(expensesTable.periodId, open.id));
      setSpendingCard(monthExps.filter((e) => e.paymentMethod === 'card').reduce((s, e) => s + e.amountCents, 0));
      setSpendingCash(monthExps.filter((e) => e.paymentMethod === 'cash').reduce((s, e) => s + e.amountCents, 0));
    }

    const summaries = await getPartBalanceSummaries();
    const totals: Record<string, number> = {};
    for (const k of ['A', 'B', 'C', 'D'] as const) {
      totals[k] = summaries[k].remainingCents;
    }
    setAllTimeTotals(totals);

    // Year spending: sum expenses by payment method across this calendar year
    const thisYear = new Date().getFullYear();
    const yearPeriodIds = periods.filter((p) => p.year === thisYear).map((p) => p.id);
    let yCard = 0, yCash = 0;
    for (const pid of yearPeriodIds) {
      const exps = await db.select().from(expensesTable).where(eq(expensesTable.periodId, pid));
      yCard += exps.filter((e) => e.paymentMethod === 'card').reduce((s, e) => s + e.amountCents, 0);
      yCash += exps.filter((e) => e.paymentMethod === 'cash').reduce((s, e) => s + e.amountCents, 0);
    }
    setYearSpendingCard(yCard);
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
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  async function handleRefresh() {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  }

  async function handleDonationComplete(amountCents: number) {
    if (!activePeriod) return;
    try {
      await completeDonation(activePeriod.id, amountCents);
      await load();
    } catch (error: any) {
      Alert.alert('Donation not saved', error.message ?? 'Could not complete donation');
      throw error;
    }
  }

  async function handleDonationUndo() {
    if (!activePeriod) return;
    await undoDonation(activePeriod.id);
    await load();
  }

  const hasPeriod = activePeriod != null;
  const maxSpending = Math.max(...monthlySpending.map((m) => m.cents), 1);

  const spendCurrent = spendingView === 'month'
    ? { card: spendingCard, cash: spendingCash }
    : { card: yearSpendingCard, cash: yearSpendingCash };

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <ScrollView
        contentContainerStyle={styles.scroll}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />}
      >
        {/* Header */}
        <View style={styles.header}>
          <Text style={[styles.greeting, { color: theme.colors.onBackground }]}>Welcome back</Text>
          <TouchableOpacity onPress={() => router.push('/month/list')} activeOpacity={0.7}>
          {activePeriod && (
            <Surface style={[styles.monthBadge, { backgroundColor: theme.colors.primary + '22' }]}>
              <Text style={[styles.monthText, { color: theme.colors.primary }]}>
                {formatMonthYear(activePeriod.month, activePeriod.year)}
              </Text>
            </Surface>
          )}
          </TouchableOpacity>
        </View>

        {/* Quick actions */}
        {hasPeriod && (
          <>
            <Text style={[styles.section, { color: theme.colors.onBackground + '88' }]}>ACTIONS</Text>
            <Surface style={[styles.card, { backgroundColor: theme.colors.surface, borderColor: theme.custom.cardBorder }]}>
              <View style={styles.actionRow}>
                <TouchableOpacity
                  onPress={() => router.push('/expenses/add')}
                  style={[styles.actionBtn, { backgroundColor: theme.custom.partD + '22' }]}
                >
                  <MaterialCommunityIcons name="cart-plus" size={20} color={theme.custom.partD} />
                  <Text style={[styles.actionLabel, { color: theme.custom.partD }]}>Add Expense</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={() => router.push('/transfers/add')}
                  style={[styles.actionBtn, { backgroundColor: theme.colors.primary + '22' }]}
                >
                  <MaterialCommunityIcons name="bank-transfer" size={20} color={theme.colors.primary} />
                  <Text style={[styles.actionLabel, { color: theme.colors.primary }]}>Add Transfer</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={() => router.push('/income/add')}
                  style={[styles.actionBtn, { backgroundColor: theme.custom.income + '22' }]}
                >
                  <MaterialCommunityIcons name="cash-plus" size={20} color={theme.custom.income} />
                  <Text style={[styles.actionLabel, { color: theme.custom.income }]}>Add Income</Text>
                </TouchableOpacity>
              </View>
            </Surface>
          </>
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
            {/* All-time remaining balances */}
            <Text style={[styles.section, { color: theme.colors.onBackground + '88' }]}>ALL-TIME BALANCES</Text>
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
                  <Text style={[styles.spendLabel, { color: theme.colors.onSurface + '77' }]}>Spent from card</Text>
                  <Text style={[styles.spendValue, { color: theme.colors.onSurface }]}>{formatCents(spendCurrent.card)}</Text>
                </View>
                <View style={[styles.vDivider, { backgroundColor: theme.custom.cardBorder }]} />
                <View style={{ flex: 1, alignItems: 'center' }}>
                  <MaterialCommunityIcons name="cash" size={20} color={theme.custom.partD} />
                  <Text style={[styles.spendLabel, { color: theme.colors.onSurface + '77' }]}>Spent from cash</Text>
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
                          <View style={styles.barTrack}>
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

            {/* Monthly Periods */}
            <TouchableOpacity onPress={() => router.push('/month/list')} activeOpacity={0.7}>
              <Surface style={[styles.card, { backgroundColor: theme.colors.surface, borderColor: theme.custom.cardBorder, flexDirection: 'row', alignItems: 'center', gap: 12 }]}>
                <MaterialCommunityIcons name="calendar-month" size={22} color={theme.colors.primary} />
                <Text style={[styles.allTimeLabel, { color: theme.colors.onSurface, fontWeight: '600', fontSize: 15 }]}>Monthly Periods</Text>
                <MaterialCommunityIcons name="chevron-right" size={20} color={theme.colors.onSurface + '44'} />
              </Surface>
            </TouchableOpacity>

            {/* Donation */}
            <Text style={[styles.section, { color: theme.colors.onBackground + '88' }]}>DONATION</Text>
            <DonationCard
              record={donationRecord}
              onComplete={handleDonationComplete}
              onUndo={handleDonationUndo}
            />
          </>
        )}

        <View style={{ height: 100 }} />
      </ScrollView>

      {!hasPeriod && (
        <FAB
          icon="plus"
          style={[styles.fab, { backgroundColor: theme.colors.primary }]}
          color={theme.colors.onPrimary}
          onPress={() => router.push('/month/new')}
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
  greeting: { fontSize: 22, fontWeight: '700' },
  monthBadge: { borderRadius: 8, paddingHorizontal: 12, paddingVertical: 6 },
  monthText: { fontSize: 13, fontWeight: '700' },
  section: { fontSize: 11, fontWeight: '700', letterSpacing: 1, marginTop: 12, marginBottom: 4 },
  card: { borderRadius: 12, borderWidth: 1, padding: 16, gap: 10 },
  allTimeRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  partDot: { width: 10, height: 10, borderRadius: 5 },
  allTimeLabel: { flex: 1, fontSize: 14 },
  allTimeValue: { fontSize: 14, fontWeight: '700' },
  divider: { height: 1, marginVertical: 2 },
  actionRow: { flexDirection: 'row', gap: 8 },
  actionBtn: { flex: 1, alignItems: 'center', paddingVertical: 10, borderRadius: 10, gap: 4 },
  actionLabel: { fontSize: 11, fontWeight: '700' },
  switchRow: { flexDirection: 'row', gap: 8, marginBottom: 4 },
  switchBtn: { flex: 1, alignItems: 'center', paddingVertical: 6, borderRadius: 8 },
  spendRow: { flexDirection: 'row', alignItems: 'center' },
  spendLabel: { fontSize: 12, marginTop: 4 },
  spendValue: { fontSize: 16, fontWeight: '700', marginTop: 2 },
  vDivider: { width: 1, height: 60, marginHorizontal: 8 },
  chartRow: { flexDirection: 'row', alignItems: 'flex-end', height: 120, gap: 4 },
  barCol: { flex: 1, alignItems: 'center', height: 120 },
  barValue: { fontSize: 8, marginBottom: 2 },
  barTrack: { flex: 1, alignSelf: 'stretch', justifyContent: 'flex-end', alignItems: 'center' },
  bar: { width: '80%', borderRadius: 3 },
  barLabel: { fontSize: 8, marginTop: 3 },
  noMonth: { borderRadius: 12, borderWidth: 1, padding: 24, alignItems: 'center', gap: 8, marginTop: 24 },
  noMonthTitle: { fontSize: 18, fontWeight: '700' },
  noMonthSub: { fontSize: 14, textAlign: 'center', lineHeight: 22 },
  fab: { position: 'absolute', right: 16, bottom: 80 },
});
