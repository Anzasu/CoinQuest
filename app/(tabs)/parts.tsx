import React, { useCallback, useState } from 'react';
import { View, ScrollView, StyleSheet, TouchableOpacity } from 'react-native';
import { Text, Surface, Button } from 'react-native-paper';
import { useRouter } from 'expo-router';
import { useFocusEffect } from '@react-navigation/native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useAppTheme } from '@/hooks/useAppTheme';
import { usePeriods } from '@/hooks/usePeriods';
import { useLegacyImport } from '@/hooks/useLegacyImport';
import { PartCard } from '@/components/PartCard';
import { EmptyState } from '@/components/EmptyState';
import { formatCents } from '@/lib/money';
import { formatMonthYear } from '@/lib/dates';
import { db } from '@/db';
import { ledgerParts } from '@/db/schema';
import type { Period, LedgerPart } from '@/hooks/usePeriods';

type PartKey = 'A' | 'B' | 'C' | 'D';

const PART_LABELS: Record<PartKey, string> = {
  A: 'B&M Savings',
  B: 'B&M Expenses',
  C: 'Emergency Fund',
  D: 'Spending',
};

const PART_DESCRIPTIONS: Record<PartKey, string> = {
  A: 'Held for third party',
  B: 'Held for third party',
  C: 'Protected reserve',
  D: 'General spending pot',
};

export default function PartsScreen() {
  const theme = useAppTheme();
  const router = useRouter();
  const { getAllPeriods, getLedgerParts } = usePeriods();
  const { getLegacyTotals } = useLegacyImport();

  const [activePeriod, setActivePeriod] = useState<Period | null>(null);
  const [parts, setParts] = useState<LedgerPart[]>([]);
  const [legacyTotals, setLegacyTotals] = useState<Record<string, number>>({});
  const [allTimeTotals, setAllTimeTotals] = useState<Record<PartKey, number>>({ A: 0, B: 0, C: 0, D: 0 });
  const [selectedPart, setSelectedPart] = useState<PartKey | null>(null);

  useFocusEffect(
    useCallback(() => {
      async function load() {
        const periods = await getAllPeriods();
        const open = periods.find((p) => p.status === 'open') ?? periods[0] ?? null;
        setActivePeriod(open);
        if (open) {
          const p = await getLedgerParts(open.id);
          setParts(p);
        }
        const lt = await getLegacyTotals();
        setLegacyTotals(lt);

        // All-time: sum monthlyTotalCents across all periods + legacy
        const allRows = await db.select().from(ledgerParts);
        const totals: Record<PartKey, number> = { A: 0, B: 0, C: 0, D: 0 };
        for (const row of allRows) {
          totals[row.partType as PartKey] = (totals[row.partType as PartKey] ?? 0) + row.monthlyTotalCents;
        }
        for (const k of ['A', 'B', 'C', 'D'] as PartKey[]) {
          totals[k] = (totals[k] ?? 0) + (lt[k] ?? 0);
        }
        setAllTimeTotals(totals);
      }
      load();
    }, []),
  );

  const getPart = (type: PartKey) => parts.find((p) => p.partType === type);

  if (!activePeriod) {
    return (
      <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
        <View style={styles.headerPad} />
        <EmptyState
          icon="chart-pie"
          title="No month started"
          description="Start a new month from the Dashboard to see your parts."
        />
      </View>
    );
  }

  // Part detail inline view
  if (selectedPart) {
    const part = getPart(selectedPart);
    const color = theme.custom[`part${selectedPart}` as keyof typeof theme.custom] as string;
    const canTransfer = selectedPart === 'A' || selectedPart === 'B';
    const canCashOut = true; // all parts support cash withdrawal

    return (
      <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
        <ScrollView contentContainerStyle={styles.scroll}>
          {/* Back button */}
          <TouchableOpacity onPress={() => setSelectedPart(null)} style={styles.backRow}>
            <MaterialCommunityIcons name="arrow-left" size={22} color={theme.colors.primary} />
            <Text style={[styles.backText, { color: theme.colors.primary }]}>Parts</Text>
          </TouchableOpacity>

          {/* Part header */}
          <View style={[styles.partHeader, { borderLeftColor: color, borderLeftWidth: 4 }]}>
            <Text style={[styles.partName, { color: theme.colors.onBackground }]}>{PART_LABELS[selectedPart]}</Text>
            <Text style={[styles.partDesc, { color: theme.colors.onBackground + '77' }]}>{PART_DESCRIPTIONS[selectedPart]}</Text>
          </View>

          {/* Monthly balance card */}
          <Text style={[styles.section, { color: theme.colors.onBackground + '88' }]}>THIS MONTH</Text>
          <Surface style={[styles.balanceCard, { backgroundColor: theme.colors.surface, borderColor: color + '44' }]}>
            <Text style={[styles.balanceLabel, { color: theme.colors.onSurface + '77' }]}>Current balance</Text>
            <Text style={[styles.balanceBig, { color }]}>{formatCents(part?.currentBalanceCents ?? 0)}</Text>
            <View style={styles.statRow}>
              <StatBox label="Started with" value={part?.monthlyTotalCents ?? 0} theme={theme} />
              {(selectedPart === 'A' || selectedPart === 'B') && (
                <>
                  <StatBox label="Transferred out" value={part?.transferredOutAmountCents ?? 0} theme={theme} negative />
                  <StatBox label="Cash withdrawn" value={part?.withdrawnCashAmountCents ?? 0} theme={theme} negative />
                </>
              )}
              {selectedPart === 'C' && (
                <StatBox label="Cash withdrawn" value={part?.withdrawnCashAmountCents ?? 0} theme={theme} negative />
              )}
              {selectedPart === 'D' && (
                <>
                  <StatBox label="Spent" value={part?.spentAmountCents ?? 0} theme={theme} negative />
                  <StatBox label="Cash withdrawn" value={part?.withdrawnCashAmountCents ?? 0} theme={theme} negative />
                </>
              )}
            </View>
          </Surface>

          {/* All-time balance card */}
          <Text style={[styles.section, { color: theme.colors.onBackground + '88' }]}>ALL-TIME TOTAL</Text>
          <Surface style={[styles.balanceCard, { backgroundColor: theme.colors.surface, borderColor: theme.custom.cardBorder }]}>
            <Text style={[styles.balanceLabel, { color: theme.colors.onSurface + '77' }]}>All months + legacy imports</Text>
            <Text style={[styles.balanceMid, { color: theme.colors.onSurface }]}>{formatCents(allTimeTotals[selectedPart] ?? 0)}</Text>
            {(legacyTotals[selectedPart] ?? 0) > 0 && (
              <Text style={[styles.legacyNote, { color: theme.colors.onSurface + '66' }]}>
                Incl. {formatCents(legacyTotals[selectedPart])} legacy import
              </Text>
            )}
          </Surface>

          {/* Quick actions */}
          <Text style={[styles.section, { color: theme.colors.onBackground + '88' }]}>ACTIONS</Text>
          <View style={styles.actionsRow}>
            <Button
              mode="contained-tonal"
              icon="cash-minus"
              onPress={() => router.push({
                pathname: '/transfers/add',
                params: { periodId: activePeriod.id, preselect: `${selectedPart}CashWithdrawal` },
              })}
              style={styles.actionBtn}
            >
              Cash Out
            </Button>
            {canTransfer && (
              <Button
                mode="contained"
                icon="bank-transfer-out"
                onPress={() => router.push({
                  pathname: '/transfers/add',
                  params: { periodId: activePeriod.id, preselect: `${selectedPart}toExternal` },
                })}
                style={styles.actionBtn}
              >
                Transfer Out
              </Button>
            )}
            {selectedPart === 'D' && (
              <Button
                mode="contained"
                icon="piggy-bank"
                onPress={() => router.push({
                  pathname: '/transfers/add',
                  params: { periodId: activePeriod.id, preselect: 'DtoPiggyBank' },
                })}
                style={styles.actionBtn}
              >
                To Piggy Bank
              </Button>
            )}
          </View>

          {/* View full monthly history */}
          <Button
            mode="text"
            icon="history"
            onPress={() => router.push({ pathname: '/month/[id]', params: { id: activePeriod.id, tab: selectedPart } })}
            style={{ marginTop: 8 }}
          >
            View full transaction history
          </Button>

          <View style={{ height: 24 }} />
        </ScrollView>
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <View style={styles.header}>
          <Text style={[styles.title, { color: theme.colors.onBackground }]}>Parts</Text>
          <Text style={[styles.subtitle, { color: theme.colors.onBackground + '77' }]}>
            {formatMonthYear(activePeriod.month, activePeriod.year)}
          </Text>
        </View>

        <Text style={[styles.section, { color: theme.colors.onBackground + '88' }]}>B&M SAVINGS</Text>
        <PartCard
          part="A"
          label="B&M Savings"
          description="Held for third party"
          currentBalance={getPart('A')?.currentBalanceCents ?? 0}
          monthlyTotal={getPart('A')?.monthlyTotalCents ?? 0}
          onPress={() => setSelectedPart('A')}
          extra={[
            { label: 'Transferred out', value: getPart('A')?.transferredOutAmountCents ?? 0 },
            { label: 'Cash withdrawn', value: getPart('A')?.withdrawnCashAmountCents ?? 0 },
          ]}
        />

        <Text style={[styles.section, { color: theme.colors.onBackground + '88' }]}>B&M EXPENSES</Text>
        <PartCard
          part="B"
          label="B&M Expenses"
          description="Held for third party"
          currentBalance={getPart('B')?.currentBalanceCents ?? 0}
          monthlyTotal={getPart('B')?.monthlyTotalCents ?? 0}
          onPress={() => setSelectedPart('B')}
          extra={[
            { label: 'Transferred out', value: getPart('B')?.transferredOutAmountCents ?? 0 },
            { label: 'Cash withdrawn', value: getPart('B')?.withdrawnCashAmountCents ?? 0 },
          ]}
        />

        <Text style={[styles.section, { color: theme.colors.onBackground + '88' }]}>EMERGENCY FUND</Text>
        <PartCard
          part="C"
          label="Emergency Fund"
          description="Protected reserve"
          currentBalance={getPart('C')?.currentBalanceCents ?? 0}
          monthlyTotal={getPart('C')?.monthlyTotalCents ?? 0}
          onPress={() => setSelectedPart('C')}
          extra={[
            { label: 'Cash withdrawn', value: getPart('C')?.withdrawnCashAmountCents ?? 0 },
          ]}
        />

        <Text style={[styles.section, { color: theme.colors.onBackground + '88' }]}>SPENDING</Text>
        <PartCard
          part="D"
          label="Spending"
          description="General spending pot"
          currentBalance={getPart('D')?.currentBalanceCents ?? 0}
          monthlyTotal={getPart('D')?.monthlyTotalCents ?? 0}
          onPress={() => setSelectedPart('D')}
          extra={[
            { label: 'Total spent', value: getPart('D')?.spentAmountCents ?? 0 },
            { label: 'Cash withdrawn', value: getPart('D')?.withdrawnCashAmountCents ?? 0 },
          ]}
        />

        {/* Salary split summary */}
        <Text style={[styles.section, { color: theme.colors.onBackground + '88' }]}>MONTH SUMMARY</Text>
        <View style={[styles.summaryBox, { backgroundColor: theme.colors.surface, borderColor: theme.custom.cardBorder }]}>
          <Row label="Salary" value={activePeriod.salaryAmountCents} theme={theme} />
          <Row label="Bills deducted" value={-activePeriod.totalBillsAmountCents} theme={theme} negative />
          <View style={[styles.divider, { backgroundColor: theme.custom.cardBorder }]} />
          <Row label="After bills" value={activePeriod.remainingAfterBillsCents} theme={theme} />
          <Row label="B&M Savings (25%)" value={activePeriod.partAAmountCents} theme={theme} color={theme.custom.partA} />
          <Row label="B&M Expenses (25%)" value={activePeriod.partBAmountCents} theme={theme} color={theme.custom.partB} />
          <Row label="Emergency Fund (25%)" value={activePeriod.partCAmountCents} theme={theme} color={theme.custom.partC} />
          <Row label="Spending (25%)" value={activePeriod.partDAmountCents} theme={theme} color={theme.custom.partD} />
        </View>

        <View style={{ height: 24 }} />
      </ScrollView>
    </View>
  );
}

function StatBox({ label, value, theme, negative }: { label: string; value: number; theme: any; negative?: boolean }) {
  return (
    <View style={{ alignItems: 'center', flex: 1 }}>
      <Text style={{ fontSize: 11, color: theme.colors.onSurface + '77' }}>{label}</Text>
      <Text style={{ fontSize: 13, fontWeight: '700', color: negative ? theme.colors.error : theme.colors.onSurface }}>
        {formatCents(value)}
      </Text>
    </View>
  );
}

function Row({ label, value, theme, negative, color }: { label: string; value: number; theme: any; negative?: boolean; color?: string }) {
  return (
    <View style={styles.row}>
      <Text style={[styles.rowLabel, { color: theme.colors.onSurface + '99' }]}>{label}</Text>
      <Text style={[styles.rowValue, { color: color ?? (negative ? theme.colors.error : theme.colors.onSurface) }]}>
        {negative ? '-' : ''}{formatCents(Math.abs(value))}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  scroll: { padding: 16, gap: 4 },
  headerPad: { height: 64 },
  header: { paddingTop: 48, marginBottom: 16 },
  title: { fontSize: 28, fontWeight: '800' },
  subtitle: { fontSize: 14, marginTop: 4 },
  section: { fontSize: 11, fontWeight: '700', letterSpacing: 1, marginTop: 12, marginBottom: 4 },
  summaryBox: { borderRadius: 12, borderWidth: 1, padding: 16, gap: 8 },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  rowLabel: { fontSize: 14 },
  rowValue: { fontSize: 14, fontWeight: '700' },
  divider: { height: 1, marginVertical: 4 },
  // Detail view
  backRow: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingTop: 48, marginBottom: 12 },
  backText: { fontSize: 15, fontWeight: '600' },
  partHeader: { paddingLeft: 12, marginBottom: 4 },
  partName: { fontSize: 22, fontWeight: '800' },
  partDesc: { fontSize: 14 },
  balanceCard: { borderRadius: 12, borderWidth: 1, padding: 16, gap: 8 },
  balanceLabel: { fontSize: 12, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.5 },
  balanceBig: { fontSize: 36, fontWeight: '800' },
  balanceMid: { fontSize: 28, fontWeight: '800' },
  legacyNote: { fontSize: 12 },
  statRow: { flexDirection: 'row', gap: 8, flexWrap: 'wrap', marginTop: 4 },
  actionsRow: { flexDirection: 'row', gap: 10, flexWrap: 'wrap' },
  actionBtn: { flex: 1, minWidth: 120 },
});
