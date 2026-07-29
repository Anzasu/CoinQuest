import React, { useState } from 'react';
import { View, ScrollView, StyleSheet, Alert } from 'react-native';
import { Text, Button, SegmentedButtons, Appbar, TextInput } from 'react-native-paper';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useAppTheme } from '@/hooks/useAppTheme';
import { useExpenses } from '@/hooks/useExpenses';
import { usePeriods } from '@/hooks/usePeriods';
import { MoneyInput } from '@/components/MoneyInput';
import { CategoryGrid } from '@/components/CategoryPicker';
import { todayIso } from '@/lib/dates';
import type { ExpenseCategory } from '@/lib/categories';

export default function AddExpenseScreen() {
  const { periodId: pidParam } = useLocalSearchParams<{ periodId?: string }>();
  const theme = useAppTheme();
  const router = useRouter();
  const { addExpense } = useExpenses();
  const { getAllPeriods } = usePeriods();

  const [amountCents, setAmountCents] = useState<number | null>(null);
  const [date, setDate] = useState(todayIso());
  const [category, setCategory] = useState<ExpenseCategory | null>(null);
  const [paymentMethod, setPaymentMethod] = useState<'cash' | 'card'>('card');
  const [note, setNote] = useState('');
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  function validate(): boolean {
    const errs: Record<string, string> = {};
    if (!amountCents || amountCents <= 0) errs.amount = 'Enter a valid amount';
    if (!category) errs.category = 'Select a category';
    if (!date) errs.date = 'Enter a date';
    setErrors(errs);
    return Object.keys(errs).length === 0;
  }

  async function handleSave() {
    if (!validate()) return;
    setSaving(true);

    try {
      // Resolve period: use param or get active open period
      let periodId = pidParam ? Number(pidParam) : null;
      if (!periodId) {
        const periods = await getAllPeriods();
        const open = periods.find((p) => p.status === 'open');
        if (!open) {
          Alert.alert('No active month', 'Start a new month before adding expenses.');
          return;
        }
        periodId = open.id;
      }

      await addExpense({
        periodId,
        amountCents: amountCents!,
        date,
        category: category!,
        paymentMethod,
        note: note.trim() || undefined,
      });

      router.back();
    } catch (e: any) {
      Alert.alert('Error', e.message ?? 'Could not save expense');
    } finally {
      setSaving(false);
    }
  }

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <Appbar.Header style={{ backgroundColor: theme.colors.surface }}>
        <Appbar.BackAction onPress={() => router.back()} color={theme.colors.primary} />
        <Appbar.Content title="Add Expense" color={theme.colors.onSurface} />
      </Appbar.Header>

      <ScrollView contentContainerStyle={styles.scroll}>
        <MoneyInput label="Amount" valueCents={amountCents} onChange={setAmountCents} error={errors.amount} />

        <TextInput
          label="Date (YYYY-MM-DD)"
          value={date}
          onChangeText={setDate}
          mode="outlined"
          style={{ backgroundColor: theme.colors.surface }}
          error={!!errors.date}
        />

        <Text style={[styles.label, { color: theme.colors.onBackground + '88' }]}>PAYMENT METHOD</Text>
        <SegmentedButtons
          value={paymentMethod}
          onValueChange={(v) => setPaymentMethod(v as 'cash' | 'card')}
          buttons={[
            { value: 'card', label: 'Card' },
            { value: 'cash', label: 'Cash' },
          ]}
        />

        <Text style={[styles.label, { color: theme.colors.onBackground + '88' }]}>
          CATEGORY {errors.category ? <Text style={{ color: theme.colors.error }}>— {errors.category}</Text> : null}
        </Text>
        <CategoryGrid selected={category} onSelect={setCategory} />

        <TextInput
          label="Note (optional)"
          value={note}
          onChangeText={setNote}
          mode="outlined"
          multiline
          numberOfLines={2}
          style={{ backgroundColor: theme.colors.surface }}
        />

        <View style={{ height: 16 }} />
      </ScrollView>

      <View style={[styles.footer, { backgroundColor: theme.colors.surface, borderTopColor: theme.custom.cardBorder }]}>
        <Button mode="outlined" onPress={() => router.back()}>Cancel</Button>
        <Button mode="contained" onPress={handleSave} loading={saving} disabled={saving} style={styles.saveBtn}>
          Save Expense
        </Button>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  scroll: { padding: 16, gap: 12 },
  label: { fontSize: 11, fontWeight: '700', letterSpacing: 1, marginTop: 4 },
  footer: { flexDirection: 'row', padding: 16, gap: 12, borderTopWidth: 1, justifyContent: 'flex-end' },
  saveBtn: { flex: 1 },
});
