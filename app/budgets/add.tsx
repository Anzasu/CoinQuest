import React, { useCallback, useState } from 'react';
import { View, ScrollView, StyleSheet, Alert } from 'react-native';
import { Text, Appbar, Button, Menu } from 'react-native-paper';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useAppTheme } from '@/hooks/useAppTheme';
import { db } from '@/db';
import { budgets } from '@/db/schema';
import { MoneyInput } from '@/components/MoneyInput';
import { EXPENSE_CATEGORIES, type ExpenseCategory } from '@/lib/categories';
import { nowIso } from '@/lib/dates';

export default function AddBudgetScreen() {
  const { periodId: pidParam } = useLocalSearchParams<{ periodId?: string }>();
  const theme = useAppTheme();
  const router = useRouter();

  const [category, setCategory] = useState<ExpenseCategory | null>(null);
  const [limitCents, setLimitCents] = useState<number | null>(null);
  const [menuVisible, setMenuVisible] = useState(false);
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  async function handleSave() {
    const errs: Record<string, string> = {};
    if (!category) errs.category = 'Select a category';
    if (!limitCents || limitCents <= 0) errs.amount = 'Enter a valid limit';
    setErrors(errs);
    if (Object.keys(errs).length > 0) return;

    setSaving(true);
    try {
      await db.insert(budgets).values({
        periodId: Number(pidParam),
        scope: 'category',
        category: category!,
        limitAmountCents: limitCents!,
        spentAmountCents: 0,
        status: 'under',
        createdAt: nowIso(),
      });
      router.back();
    } catch (e: any) {
      Alert.alert('Error', e.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <Appbar.Header style={{ backgroundColor: theme.colors.surface }}>
        <Appbar.BackAction onPress={() => router.back()} color={theme.colors.primary} />
        <Appbar.Content title="Add Budget" color={theme.colors.onSurface} />
      </Appbar.Header>

      <ScrollView contentContainerStyle={styles.scroll}>
        <Text style={[styles.label, { color: errors.category ? theme.colors.error : theme.colors.onBackground + '88' }]}>
          CATEGORY {errors.category ? `— ${errors.category}` : ''}
        </Text>
        <Menu
          visible={menuVisible}
          onDismiss={() => setMenuVisible(false)}
          anchor={
            <Button mode="outlined" onPress={() => setMenuVisible(true)}>
              {category ?? 'Select category'}
            </Button>
          }
        >
          {EXPENSE_CATEGORIES.map((cat) => (
            <Menu.Item key={cat} title={cat} onPress={() => { setCategory(cat); setMenuVisible(false); }} />
          ))}
        </Menu>

        <MoneyInput label="Monthly limit" valueCents={limitCents} onChange={setLimitCents} error={errors.amount} />

        <View style={{ height: 16 }} />
      </ScrollView>

      <View style={[styles.footer, { backgroundColor: theme.colors.surface, borderTopColor: theme.custom.cardBorder }]}>
        <Button mode="outlined" onPress={() => router.back()}>Cancel</Button>
        <Button mode="contained" onPress={handleSave} loading={saving} disabled={saving} style={{ flex: 1 }}>
          Save Budget
        </Button>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  scroll: { padding: 16, gap: 12 },
  label: { fontSize: 11, fontWeight: '700', letterSpacing: 1 },
  footer: { flexDirection: 'row', padding: 16, gap: 12, borderTopWidth: 1 },
});
