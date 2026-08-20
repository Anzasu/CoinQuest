import React, { useEffect, useState } from 'react';
import {
  View, ScrollView, StyleSheet, Alert, KeyboardAvoidingView, Platform
} from 'react-native';
import {
  Text, Button, TextInput, Divider, IconButton, Surface, Appbar
} from 'react-native-paper';
import { useRouter } from 'expo-router';
import { useAppTheme } from '@/hooks/useAppTheme';
import { usePeriods } from '@/hooks/usePeriods';
import { useBills } from '@/hooks/useBills';
import { MoneyInput } from '@/components/MoneyInput';
import { splitSalary, remainingAfterBills, calculateDonationGoal, formatCents } from '@/lib/money';
import { currentMonth, formatMonthYear, resolveNewMonthTarget } from '@/lib/dates';

interface BillRow {
  templateId?: number;
  name: string;
  amountCents: number | null;
  nameError?: string;
  amountError?: string;
}

type Step = 'salary' | 'bills' | 'preview';

export default function NewMonthScreen() {
  const theme = useAppTheme();
  const router = useRouter();
  const { startNewMonth, getPeriodByMonthYear } = usePeriods();
  const { getActiveTemplates } = useBills();

  const [targetMonth, setTargetMonth] = useState<number | null>(null);
  const [targetYear, setTargetYear] = useState<number | null>(null);
  const [step, setStep] = useState<Step>('salary');
  const [salary, setSalary] = useState<number | null>(null);
  const [salaryError, setSalaryError] = useState('');
  const [bills, setBills] = useState<BillRow[]>([]);
  const [budgetCents, setBudgetCents] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    async function load() {
      const current = currentMonth();
      const currentPeriod = await getPeriodByMonthYear(current.month, current.year);
      const next = current.month === 12
        ? { month: 1, year: current.year + 1 }
        : { month: current.month + 1, year: current.year };
      const nextPeriod = currentPeriod
        ? await getPeriodByMonthYear(next.month, next.year)
        : undefined;
      const target = resolveNewMonthTarget(current, !!currentPeriod, !!nextPeriod);

      if (!target) {
        Alert.alert(
          'Months already exist',
          `${formatMonthYear(current.month, current.year)} and ${formatMonthYear(next.month, next.year)} have already been created.`,
          [{ text: 'OK', onPress: () => router.back() }],
        );
        return;
      }

      setTargetMonth(target.month);
      setTargetYear(target.year);

      try {
        const templates = await getActiveTemplates();
        setBills(
          templates.map((t) => ({
            templateId: t.id,
            name: t.name,
            amountCents: t.amountCents,
          })),
        );
      } catch (error: any) {
        Alert.alert(
          'Error',
          error?.message ?? 'Could not prepare the new month',
          [{ text: 'OK', onPress: () => router.back() }],
        );
      }
    }
    load();
  }, []);

  const totalBills = bills.reduce((s, b) => s + (b.amountCents ?? 0), 0);
  const remaining = salary != null ? Math.max(0, salary - totalBills) : 0;
  const split = salary != null ? splitSalary(remaining) : null;
  const donationGoal = split != null ? calculateDonationGoal(split.partD) : 0;

  function addBill() {
    setBills((prev) => [...prev, { name: '', amountCents: null }]);
  }

  function removeBill(idx: number) {
    setBills((prev) => prev.filter((_, i) => i !== idx));
  }

  function updateBillName(idx: number, name: string) {
    setBills((prev) => prev.map((b, i) => (i === idx ? { ...b, name, nameError: undefined } : b)));
  }

  function updateBillAmount(idx: number, cents: number | null) {
    setBills((prev) => prev.map((b, i) => (i === idx ? { ...b, amountCents: cents, amountError: undefined } : b)));
  }

  function validateSalary(): boolean {
    if (!salary || salary <= 0) {
      setSalaryError('Please enter a valid salary amount.');
      return false;
    }
    setSalaryError('');
    return true;
  }

  function validateBills(): boolean {
    let ok = true;
    setBills((prev) =>
      prev.map((b) => {
        const nameError = !b.name.trim() ? 'Required' : undefined;
        const amountError = !b.amountCents || b.amountCents <= 0 ? 'Required' : undefined;
        if (nameError || amountError) ok = false;
        return { ...b, nameError, amountError };
      }),
    );
    return ok;
  }

  function handleNext() {
    if (step === 'salary') {
      if (!validateSalary()) return;
      setStep('bills');
    } else if (step === 'bills') {
      if (!validateBills()) return;
      if (totalBills >= (salary ?? 0)) {
        Alert.alert('Bills exceed salary', 'Total bills cannot exceed the salary amount.');
        return;
      }
      setStep('preview');
    }
  }

  async function handleConfirm() {
    if (!salary || !split || targetMonth == null || targetYear == null) return;
    setSaving(true);
    try {
      await startNewMonth({
        month: targetMonth,
        year: targetYear,
        salaryAmountCents: salary,
        bills: bills
          .filter((b) => b.amountCents != null && b.amountCents > 0)
          .map((b) => ({
            templateId: b.templateId,
            name: b.name,
            amountCents: b.amountCents!,
          })),
        monthlyBudgetLimitCents: budgetCents ?? undefined,
      });
      router.back();
    } catch (e: any) {
      Alert.alert('Error', e.message ?? 'Could not create month');
    } finally {
      setSaving(false);
    }
  }

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <Appbar.Header style={{ backgroundColor: theme.colors.surface }}>
        <Appbar.BackAction onPress={() => router.back()} />
        <Appbar.Content title={targetMonth == null || targetYear == null ? 'Preparing month...' : `Start ${formatMonthYear(targetMonth, targetYear)}`} />
      </Appbar.Header>

      {targetMonth == null || targetYear == null ? null : (
        <KeyboardAvoidingView
          style={styles.keyboardArea}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          keyboardVerticalOffset={0}
        >

      {/* Step indicator */}
      <View style={styles.steps}>
        {(['salary', 'bills', 'preview'] as Step[]).map((s, i) => (
          <View key={s} style={styles.stepRow}>
            <View style={[styles.stepDot, { backgroundColor: step === s ? theme.colors.primary : s < step ? theme.colors.primary + '77' : theme.colors.outline }]}>
              <Text style={styles.stepNum}>{i + 1}</Text>
            </View>
            <Text style={[styles.stepLabel, { color: step === s ? theme.colors.primary : theme.colors.onBackground + '55' }]}>
              {s === 'salary' ? 'Salary' : s === 'bills' ? 'Bills' : 'Preview'}
            </Text>
            {i < 2 && <View style={[styles.stepLine, { backgroundColor: theme.custom.cardBorder }]} />}
          </View>
        ))}
      </View>

      <ScrollView
        contentContainerStyle={styles.scroll}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
      >
        {step === 'salary' && (
          <View style={styles.form}>
            <Text style={[styles.formTitle, { color: theme.colors.onBackground }]}>Enter your salary</Text>
            <Text style={[styles.formSub, { color: theme.colors.onBackground + '77' }]}>
              Net salary after tax for {formatMonthYear(targetMonth, targetYear)}.
            </Text>
            <MoneyInput label="Salary" valueCents={salary} onChange={setSalary} error={salaryError} />
            <Divider style={{ marginVertical: 16 }} />
            <Text style={[styles.formTitle, { color: theme.colors.onBackground }]}>Optional: monthly budget limit</Text>
            <MoneyInput label="Overall budget (optional)" valueCents={budgetCents} onChange={setBudgetCents} />
          </View>
        )}

        {step === 'bills' && (
          <View style={styles.form}>
            <Text style={[styles.formTitle, { color: theme.colors.onBackground }]}>Fixed bills</Text>
            <Text style={[styles.formSub, { color: theme.colors.onBackground + '77' }]}>
              Bills are deducted before the salary is split. Edit amounts or remove bills that don't apply this month.
            </Text>

            {bills.map((bill, idx) => (
              <Surface key={idx} style={[styles.billRow, { backgroundColor: theme.colors.surface, borderColor: theme.custom.cardBorder }]}>
                <View style={styles.billFields}>
                  <TextInput
                    label="Bill name"
                    value={bill.name}
                    onChangeText={(t) => updateBillName(idx, t)}
                    mode="outlined"
                    error={!!bill.nameError}
                    style={[styles.billName, { backgroundColor: theme.colors.surface }]}
                    dense
                  />
                  <MoneyInput
                    label="Amount"
                    valueCents={bill.amountCents}
                    onChange={(c) => updateBillAmount(idx, c)}
                    error={bill.amountError}
                  />
                </View>
                <IconButton icon="close" size={18} onPress={() => removeBill(idx)} iconColor={theme.colors.error} />
              </Surface>
            ))}

            <Button icon="plus" mode="text" onPress={addBill} style={{ alignSelf: 'flex-start' }}>
              Add bill
            </Button>

            <Surface style={[styles.totalBox, { backgroundColor: theme.colors.surface, borderColor: theme.custom.cardBorder }]}>
              <Text style={{ color: theme.colors.onSurface + '88' }}>Total bills:</Text>
              <Text style={[styles.totalAmt, { color: theme.colors.error }]}>{formatCents(totalBills)}</Text>
              <Text style={{ color: theme.colors.onSurface + '88' }}>Remaining:</Text>
              <Text style={[styles.totalAmt, { color: theme.custom.partD }]}>{formatCents(remaining)}</Text>
            </Surface>
          </View>
        )}

        {step === 'preview' && split && (
          <View style={styles.form}>
            <Text style={[styles.formTitle, { color: theme.colors.onBackground }]}>Confirm split</Text>
            <Text style={[styles.formSub, { color: theme.colors.onBackground + '77' }]}>
              Each part gets 25% of the remaining salary. Extra cents go to A, then B.
            </Text>

            <PreviewRow label="Salary" value={salary!} color={theme.custom.income} theme={theme} />
            <PreviewRow label="Bills deducted" value={-totalBills} color={theme.colors.error} theme={theme} />
            <Divider style={{ marginVertical: 8 }} />
            <PreviewRow label="Remaining after bills" value={remaining} color={theme.colors.onBackground} theme={theme} />
            <Divider style={{ marginVertical: 4 }} />
            <PreviewRow label="B&M Savings (25%)" value={split.partA} color={theme.custom.partA} theme={theme} />
            <PreviewRow label="B&M Expenses (25%)" value={split.partB} color={theme.custom.partB} theme={theme} />
            <PreviewRow label="Emergency Fund (25%)" value={split.partC} color={theme.custom.partC} theme={theme} />
            <PreviewRow label="Spending after donation" value={split.partD - donationGoal} color={theme.custom.partD} theme={theme} />
            <Divider style={{ marginVertical: 8 }} />
            <PreviewRow label="Donation goal (25% of D)" value={donationGoal} color={theme.colors.secondary} theme={theme} />
            {budgetCents != null && (
              <PreviewRow label="Monthly budget" value={budgetCents} color={theme.colors.primary} theme={theme} />
            )}
          </View>
        )}
      </ScrollView>

      <View style={[styles.footer, { backgroundColor: theme.colors.surface, borderTopColor: theme.custom.cardBorder }]}>
        {step !== 'salary' && (
          <Button mode="outlined" onPress={() => setStep(step === 'preview' ? 'bills' : 'salary')}>
            Back
          </Button>
        )}
        {step !== 'preview' ? (
          <Button mode="contained" onPress={handleNext} style={styles.nextBtn}>
            Next
          </Button>
        ) : (
          <Button mode="contained" onPress={handleConfirm} loading={saving} disabled={saving} style={styles.nextBtn}>
            Confirm & Start Month
          </Button>
        )}
      </View>
        </KeyboardAvoidingView>
      )}
    </View>
  );
}

function PreviewRow({ label, value, color, theme }: { label: string; value: number; color: string; theme: any }) {
  const isNeg = value < 0;
  return (
    <View style={styles.previewRow}>
      <Text style={[styles.previewLabel, { color: theme.colors.onBackground + '88' }]}>{label}</Text>
      <Text style={[styles.previewValue, { color }]}>
        {isNeg ? '-' : ''}{formatCents(Math.abs(value))}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  keyboardArea: { flex: 1 },
  steps: { flexDirection: 'row', alignItems: 'center', padding: 16, gap: 0 },
  stepRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  stepDot: { width: 24, height: 24, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  stepNum: { color: '#fff', fontSize: 11, fontWeight: '800' },
  stepLabel: { fontSize: 12, fontWeight: '600' },
  stepLine: { width: 24, height: 1, marginHorizontal: 4 },
  scroll: { padding: 16, paddingBottom: 32, gap: 12 },
  form: { gap: 12 },
  formTitle: { fontSize: 18, fontWeight: '700' },
  formSub: { fontSize: 14, lineHeight: 20 },
  billRow: {
    borderRadius: 10,
    borderWidth: 1,
    padding: 12,
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    marginBottom: 4,
  },
  billFields: { flex: 1, gap: 8 },
  billName: { flex: 1 },
  totalBox: { borderRadius: 10, borderWidth: 1, padding: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 8 },
  totalAmt: { fontSize: 16, fontWeight: '700' },
  previewRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 4 },
  previewLabel: { fontSize: 14 },
  previewValue: { fontSize: 14, fontWeight: '700' },
  footer: {
    flexDirection: 'row',
    padding: 16,
    gap: 12,
    borderTopWidth: 1,
    justifyContent: 'flex-end',
  },
  nextBtn: { flex: 1 },
});
