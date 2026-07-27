import React, { useCallback, useState } from 'react';
import { View, ScrollView, StyleSheet } from 'react-native';
import { Text } from 'react-native-paper';
import { useRouter } from 'expo-router';
import { useFocusEffect } from '@react-navigation/native';
import { useAppTheme } from '@/hooks/useAppTheme';
import { usePeriods } from '@/hooks/usePeriods';
import { useLegacyImport } from '@/hooks/useLegacyImport';
import { PartCard } from '@/components/PartCard';
import { EmptyState } from '@/components/EmptyState';
import { formatCents } from '@/lib/money';
import { formatMonthYear } from '@/lib/dates';
import type { Period, LedgerPart } from '@/hooks/usePeriods';

export default function PartsScreen() {
  const theme = useAppTheme();
  const router = useRouter();
  const { getAllPeriods, getLedgerParts } = usePeriods();
  const { getLegacyTotals } = useLegacyImport();

  const [activePeriod, setActivePeriod] = useState<Period | null>(null);
  const [parts, setParts] = useState<LedgerPart[]>([]);
  const [legacyTotals, setLegacyTotals] = useState<Record<string, number>>({});

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
      }
      load();
    }, []),
  );

  const getPart = (type: 'A' | 'B' | 'C' | 'D') => parts.find((p) => p.partType === type);

  function allTimeTotal(type: 'A' | 'B' | 'C' | 'D'): number {
    const part = getPart(type);
    return (part?.monthlyTotalCents ?? 0) + (legacyTotals[type] ?? 0);
  }

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

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <View style={styles.header}>
          <Text style={[styles.title, { color: theme.colors.onBackground }]}>Parts</Text>
          <Text style={[styles.subtitle, { color: theme.colors.onBackground + '77' }]}>
            {formatMonthYear(activePeriod.month, activePeriod.year)}
          </Text>
        </View>

        <Text style={[styles.section, { color: theme.colors.onBackground + '88' }]}>THIRD PARTY</Text>
        <PartCard
          part="A"
          label="Part A"
          description="Held for third party"
          currentBalance={getPart('A')?.currentBalanceCents ?? 0}
          monthlyTotal={getPart('A')?.monthlyTotalCents ?? 0}
          onPress={() => router.push({ pathname: '/month/[id]', params: { id: activePeriod.id, tab: 'A' } })}
          extra={[
            { label: 'Transferred out', value: getPart('A')?.transferredOutAmountCents ?? 0 },
            { label: 'Cash withdrawn', value: getPart('A')?.withdrawnCashAmountCents ?? 0 },
          ]}
        />
        <PartCard
          part="B"
          label="Part B"
          description="Held for third party"
          currentBalance={getPart('B')?.currentBalanceCents ?? 0}
          monthlyTotal={getPart('B')?.monthlyTotalCents ?? 0}
          onPress={() => router.push({ pathname: '/month/[id]', params: { id: activePeriod.id, tab: 'B' } })}
          extra={[
            { label: 'Transferred out', value: getPart('B')?.transferredOutAmountCents ?? 0 },
            { label: 'Cash withdrawn', value: getPart('B')?.withdrawnCashAmountCents ?? 0 },
          ]}
        />

        <Text style={[styles.section, { color: theme.colors.onBackground + '88' }]}>SAVINGS</Text>
        <PartCard
          part="C"
          label="Part C"
          description="Emergency fund"
          currentBalance={getPart('C')?.currentBalanceCents ?? 0}
          monthlyTotal={getPart('C')?.monthlyTotalCents ?? 0}
          onPress={() => router.push({ pathname: '/month/[id]', params: { id: activePeriod.id, tab: 'C' } })}
          extra={[
            { label: 'Cash withdrawn', value: getPart('C')?.withdrawnCashAmountCents ?? 0 },
          ]}
        />

        <Text style={[styles.section, { color: theme.colors.onBackground + '88' }]}>SPENDING</Text>
        <PartCard
          part="D"
          label="Part D"
          description="General spending pot"
          currentBalance={getPart('D')?.currentBalanceCents ?? 0}
          monthlyTotal={getPart('D')?.monthlyTotalCents ?? 0}
          onPress={() => router.push({ pathname: '/month/[id]', params: { id: activePeriod.id, tab: 'D' } })}
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
          <Row label="Part A (25%)" value={activePeriod.partAAmountCents} theme={theme} color={theme.custom.partA} />
          <Row label="Part B (25%)" value={activePeriod.partBAmountCents} theme={theme} color={theme.custom.partB} />
          <Row label="Part C (25%)" value={activePeriod.partCAmountCents} theme={theme} color={theme.custom.partC} />
          <Row label="Part D (25%)" value={activePeriod.partDAmountCents} theme={theme} color={theme.custom.partD} />
        </View>

        <View style={{ height: 24 }} />
      </ScrollView>
    </View>
  );
}

function Row({
  label,
  value,
  theme,
  negative,
  color,
}: {
  label: string;
  value: number;
  theme: any;
  negative?: boolean;
  color?: string;
}) {
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
  header: { paddingTop: 48, marginBottom: 16 },
  title: { fontSize: 28, fontWeight: '800' },
  subtitle: { fontSize: 14, marginTop: 4 },
  section: { fontSize: 11, fontWeight: '700', letterSpacing: 1, marginTop: 12, marginBottom: 4 },
  summaryBox: {
    borderRadius: 12,
    borderWidth: 1,
    padding: 16,
    gap: 8,
  },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  rowLabel: { fontSize: 14 },
  rowValue: { fontSize: 14, fontWeight: '700' },
  divider: { height: 1, marginVertical: 4 },
});
