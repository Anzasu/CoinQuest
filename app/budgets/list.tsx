import React, { useCallback, useState } from 'react';
import { View, ScrollView, StyleSheet } from 'react-native';
import { Text, Appbar, Surface, Button } from 'react-native-paper';
import { useRouter } from 'expo-router';
import { useFocusEffect } from '@react-navigation/native';
import { useAppTheme } from '@/hooks/useAppTheme';
import { usePeriods } from '@/hooks/usePeriods';
import { db } from '@/db';
import { budgets } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { formatCents } from '@/lib/money';
import { formatMonthYear } from '@/lib/dates';
import { EmptyState } from '@/components/EmptyState';

export default function BudgetsListScreen() {
  const theme = useAppTheme();
  const router = useRouter();
  const { getAllPeriods } = usePeriods();
  const [allBudgets, setAllBudgets] = useState<any[]>([]);
  const [periods, setPeriods] = useState<any[]>([]);

  useFocusEffect(
    useCallback(() => {
      async function load() {
        const ps = await getAllPeriods();
        setPeriods(ps);
        const bs = await db.select().from(budgets);
        setAllBudgets(bs);
      }
      load();
    }, []),
  );

  const getPeriodLabel = (id: number) => {
    const p = periods.find((p) => p.id === id);
    return p ? formatMonthYear(p.month, p.year) : '?';
  };

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <Appbar.Header style={{ backgroundColor: theme.colors.surface }}>
        <Appbar.BackAction onPress={() => router.back()} />
        <Appbar.Content title="Budgets" />
      </Appbar.Header>

      <ScrollView contentContainerStyle={styles.scroll}>
        {allBudgets.length === 0 ? (
          <EmptyState icon="chart-bar" title="No budgets yet" description="Budgets are created when you start a new month with a budget limit." />
        ) : (
          allBudgets.map((b) => (
            <Surface key={b.id} style={[styles.row, { backgroundColor: theme.colors.surface, borderColor: b.status === 'over' ? theme.colors.error : theme.custom.cardBorder }]}>
              <View style={{ flex: 1 }}>
                <Text style={[styles.rowTitle, { color: theme.colors.onSurface }]}>
                  {getPeriodLabel(b.periodId)} · {b.scope === 'overall' ? 'Overall' : b.category}
                </Text>
                <Text style={[styles.rowSub, { color: theme.colors.onSurface + '77' }]}>
                  {formatCents(b.spentAmountCents)} / {formatCents(b.limitAmountCents)}
                  {' · '}
                  <Text style={{ color: b.status === 'over' ? theme.colors.error : theme.custom.partC }}>
                    {b.status === 'over' ? 'Over budget' : 'Under budget'}
                  </Text>
                </Text>
              </View>
            </Surface>
          ))
        )}
        <View style={{ height: 24 }} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  scroll: { padding: 16, gap: 8 },
  row: { borderRadius: 10, borderWidth: 1, padding: 14 },
  rowTitle: { fontSize: 15, fontWeight: '600' },
  rowSub: { fontSize: 13, marginTop: 2 },
});
