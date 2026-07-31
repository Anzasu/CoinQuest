import React, { useState } from 'react';
import { View, ScrollView, StyleSheet, Alert } from 'react-native';
import { Text, Button, Appbar, TextInput, SegmentedButtons } from 'react-native-paper';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useAppTheme } from '@/hooks/useAppTheme';
import { useExternalIncome } from '@/hooks/useExternalIncome';
import { usePeriods } from '@/hooks/usePeriods';
import { MoneyInput } from '@/components/MoneyInput';
import { todayIso } from '@/lib/dates';

type IncomeType = 'refund' | 'gift' | 'sideIncome' | 'other';

export default function AddIncomeScreen() {
  const { periodId: pidParam } = useLocalSearchParams<{ periodId?: string }>();
  const theme = useAppTheme();
  const router = useRouter();
  const { addExternalIncome } = useExternalIncome();
  const { getAllPeriods } = usePeriods();

  const [amountCents, setAmountCents] = useState<number | null>(null);
  const [date, setDate] = useState(todayIso());
  const [type, setType] = useState<IncomeType>('refund');
  const [note, setNote] = useState('');
  const [saving, setSaving] = useState(false);
  const [amountError, setAmountError] = useState('');

  async function handleSave() {
    if (!amountCents || amountCents <= 0) {
      setAmountError('Enter a valid amount');
      return;
    }
    setAmountError('');
    setSaving(true);

    try {
      let periodId = pidParam ? Number(pidParam) : null;
      if (!periodId) {
        const periods = await getAllPeriods();
        const d = new Date(date);
        const m = d.getMonth() + 1;
        const y = d.getFullYear();
        const matched = periods.find((p) => p.month === m && p.year === y);
        if (!matched) {
          Alert.alert('No period found', `There is no period for ${m}/${y}. Start that month first.`);
          return;
        }
        periodId = matched.id;
      }

      await addExternalIncome({
        periodId,
        amountCents,
        type,
        date,
        note: note.trim() || undefined,
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
        <Appbar.Content title="Add External Income" subtitle="Goes directly to Spending" color={theme.colors.onSurface} />
      </Appbar.Header>

      <ScrollView contentContainerStyle={styles.scroll}>
        <MoneyInput label="Amount" valueCents={amountCents} onChange={setAmountCents} error={amountError} />

        <TextInput
          label="Date (YYYY-MM-DD)"
          value={date}
          onChangeText={setDate}
          mode="outlined"
          style={{ backgroundColor: theme.colors.surface }}
        />

        <Text style={[styles.label, { color: theme.colors.onBackground + '88' }]}>INCOME TYPE</Text>
        <SegmentedButtons
          value={type}
          onValueChange={(v) => setType(v as IncomeType)}
          buttons={[
            { value: 'refund', label: 'Refund' },
            { value: 'gift', label: 'Gift' },
            { value: 'sideIncome', label: 'Side income' },
            { value: 'other', label: 'Other' },
          ]}
        />

        <TextInput
          label="Note (optional)"
          value={note}
          onChangeText={setNote}
          mode="outlined"
          multiline
          style={{ backgroundColor: theme.colors.surface }}
        />

        <Text style={[styles.hint, { color: theme.colors.onBackground + '66' }]}>
          External income goes directly to Spending and increases its available balance. It is NOT split into B&M Savings/Expenses/Emergency Fund/Spending.
        </Text>
        <View style={{ height: 16 }} />
      </ScrollView>

      <View style={[styles.footer, { backgroundColor: theme.colors.surface, borderTopColor: theme.custom.cardBorder }]}>
        <Button mode="outlined" onPress={() => router.back()}>Cancel</Button>
        <Button mode="contained" onPress={handleSave} loading={saving} disabled={saving} style={styles.saveBtn}>
          Save Income
        </Button>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  scroll: { padding: 16, gap: 12 },
  label: { fontSize: 11, fontWeight: '700', letterSpacing: 1 },
  hint: { fontSize: 13, lineHeight: 20 },
  footer: { flexDirection: 'row', padding: 16, gap: 12, borderTopWidth: 1, justifyContent: 'flex-end' },
  saveBtn: { flex: 1 },
});
