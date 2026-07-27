import React, { useCallback, useState } from 'react';
import { View, ScrollView, StyleSheet, TouchableOpacity } from 'react-native';
import { Text, Appbar, Surface, Chip } from 'react-native-paper';
import { useRouter } from 'expo-router';
import { useFocusEffect } from '@react-navigation/native';
import { useAppTheme } from '@/hooks/useAppTheme';
import { usePeriods, type Period } from '@/hooks/usePeriods';
import { formatCents } from '@/lib/money';
import { formatMonthYear } from '@/lib/dates';
import { EmptyState } from '@/components/EmptyState';

export default function MonthListScreen() {
  const theme = useAppTheme();
  const router = useRouter();
  const { getAllPeriods } = usePeriods();
  const [periods, setPeriods] = useState<Period[]>([]);

  useFocusEffect(
    useCallback(() => {
      getAllPeriods().then(setPeriods);
    }, []),
  );

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <Appbar.Header style={{ backgroundColor: theme.colors.surface }}>
        <Appbar.BackAction onPress={() => router.back()} />
        <Appbar.Content title="Monthly Periods" />
      </Appbar.Header>

      <ScrollView contentContainerStyle={styles.scroll}>
        {periods.length === 0 ? (
          <EmptyState icon="calendar-month" title="No months yet" description="Start your first month from the Dashboard." />
        ) : (
          periods.map((p) => (
            <TouchableOpacity key={p.id} onPress={() => router.push({ pathname: '/month/[id]', params: { id: p.id } })} activeOpacity={0.7}>
              <Surface style={[styles.row, { backgroundColor: theme.colors.surface, borderColor: theme.custom.cardBorder }]}>
                <View style={{ flex: 1 }}>
                  <View style={styles.rowHeader}>
                    <Text style={[styles.rowTitle, { color: theme.colors.onSurface }]}>
                      {formatMonthYear(p.month, p.year)}
                    </Text>
                    <Chip
                      compact
                      style={{ backgroundColor: p.status === 'open' ? theme.custom.partC + '22' : theme.colors.outline + '44' }}
                      textStyle={{ color: p.status === 'open' ? theme.custom.partC : theme.colors.onSurface + '66', fontSize: 11 }}
                    >
                      {p.status}
                    </Chip>
                  </View>
                  <Text style={[styles.rowSub, { color: theme.colors.onSurface + '66' }]}>
                    Salary: {formatCents(p.salaryAmountCents)} · Spent: {formatCents(p.monthlySpentCents)}
                    {p.donationCompleted ? ' · ✓ Donated' : ''}
                  </Text>
                </View>
                <Text style={[styles.chevron, { color: theme.colors.onSurface + '44' }]}>›</Text>
              </Surface>
            </TouchableOpacity>
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
  row: { borderRadius: 12, borderWidth: 1, flexDirection: 'row', alignItems: 'center', padding: 16, gap: 12 },
  rowHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 4 },
  rowTitle: { fontSize: 16, fontWeight: '700' },
  rowSub: { fontSize: 13 },
  chevron: { fontSize: 24 },
});
