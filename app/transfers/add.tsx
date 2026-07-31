import React, { useState } from 'react';
import { View, ScrollView, StyleSheet, Alert } from 'react-native';
import { Text, Button, SegmentedButtons, Appbar, TextInput, Menu } from 'react-native-paper';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useAppTheme } from '@/hooks/useAppTheme';
import { useTransfers } from '@/hooks/useTransfers';
import { usePiggyBanks } from '@/hooks/usePiggyBanks';
import { usePeriods } from '@/hooks/usePeriods';
import { MoneyInput } from '@/components/MoneyInput';
import { todayIso } from '@/lib/dates';

type TransferType = 'AtoExternal' | 'BtoExternal' | 'ACashWithdrawal' | 'BCashWithdrawal' | 'CCashWithdrawal' | 'DCashWithdrawal' | 'DtoPiggyBank';

const TRANSFER_OPTIONS: { value: TransferType; label: string; part: 'A' | 'B' | 'C' | 'D' }[] = [
  { value: 'AtoExternal', label: 'B&M Savings → Transfer out', part: 'A' },
  { value: 'BtoExternal', label: 'B&M Expenses → Transfer out', part: 'B' },
  { value: 'ACashWithdrawal', label: 'B&M Savings → Cash withdrawal', part: 'A' },
  { value: 'BCashWithdrawal', label: 'B&M Expenses → Cash withdrawal', part: 'B' },
  { value: 'CCashWithdrawal', label: 'Emergency Fund → Cash withdrawal', part: 'C' },
  { value: 'DCashWithdrawal', label: 'Spending → Cash withdrawal', part: 'D' },
  { value: 'DtoPiggyBank', label: 'Spending → Piggy Bank', part: 'D' },
];

export default function AddTransferScreen() {
  const { periodId: pidParam, preselect } = useLocalSearchParams<{ periodId?: string; preselect?: string }>();
  const theme = useAppTheme();
  const router = useRouter();
  const { addTransfer } = useTransfers();
  const { getAllPiggyBanks } = usePiggyBanks();
  const { getAllPeriods } = usePeriods();

  const [amountCents, setAmountCents] = useState<number | null>(null);
  const [date, setDate] = useState(todayIso());
  const [transferType, setTransferType] = useState<TransferType>((preselect as TransferType) ?? 'DtoPiggyBank');
  const [note, setNote] = useState('');
  const [selectedPiggyBank, setSelectedPiggyBank] = useState<number | null>(null);
  const [piggyBanks, setPiggyBanks] = useState<{ id: number; name: string }[]>([]);
  const [menuVisible, setMenuVisible] = useState(false);
  const [typeMenuVisible, setTypeMenuVisible] = useState(false);
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  React.useEffect(() => {
    getAllPiggyBanks().then((pbs) => setPiggyBanks(pbs.filter((p) => !p.isArchived)));
  }, []);

  const selectedOption = TRANSFER_OPTIONS.find((o) => o.value === transferType)!;

  function validate(): boolean {
    const errs: Record<string, string> = {};
    if (!amountCents || amountCents <= 0) errs.amount = 'Enter a valid amount';
    if (transferType === 'DtoPiggyBank' && !selectedPiggyBank) errs.piggy = 'Select a piggy bank';
    setErrors(errs);
    return Object.keys(errs).length === 0;
  }

  async function handleSave() {
    if (!validate()) return;
    setSaving(true);

    try {
      let periodId = pidParam ? Number(pidParam) : null;
      if (!periodId) {
        const periods = await getAllPeriods();
        const open = periods.find((p) => p.status === 'open');
        if (!open) {
          Alert.alert('No active month', 'Start a new month before adding transfers.');
          return;
        }
        periodId = open.id;
      }

      await addTransfer({
        periodId,
        amountCents: amountCents!,
        date,
        transferType,
        sourcePart: selectedOption.part,
        piggyBankId: transferType === 'DtoPiggyBank' ? selectedPiggyBank! : undefined,
        note: note.trim() || undefined,
      });

      router.back();
    } catch (e: any) {
      Alert.alert('Error', e.message ?? 'Could not save transfer');
    } finally {
      setSaving(false);
    }
  }

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <Appbar.Header style={{ backgroundColor: theme.colors.surface }}>
        <Appbar.BackAction onPress={() => router.back()} color={theme.colors.primary} />
        <Appbar.Content title="Add Transfer" color={theme.colors.onSurface} />
      </Appbar.Header>

      <ScrollView contentContainerStyle={styles.scroll}>
        {/* Transfer type selector */}
        <Text style={[styles.label, { color: theme.colors.onBackground + '88' }]}>TRANSFER TYPE</Text>
        <Menu
          visible={typeMenuVisible}
          onDismiss={() => setTypeMenuVisible(false)}
          anchor={
            <Button mode="outlined" onPress={() => setTypeMenuVisible(true)} style={{ marginBottom: 8 }}>
              {selectedOption.label}
            </Button>
          }
        >
          {TRANSFER_OPTIONS.map((opt) => (
            <Menu.Item
              key={opt.value}
              title={opt.label}
              onPress={() => { setTransferType(opt.value); setTypeMenuVisible(false); }}
            />
          ))}
        </Menu>

        {/* Piggy bank selector */}
        {transferType === 'DtoPiggyBank' && (
          <>
            <Text style={[styles.label, { color: errors.piggy ? theme.colors.error : theme.colors.onBackground + '88' }]}>
              PIGGY BANK {errors.piggy ? `— ${errors.piggy}` : ''}
            </Text>
            <Menu
              visible={menuVisible}
              onDismiss={() => setMenuVisible(false)}
              anchor={
                <Button mode="outlined" onPress={() => setMenuVisible(true)} style={{ marginBottom: 8 }}>
                  {selectedPiggyBank ? piggyBanks.find((p) => p.id === selectedPiggyBank)?.name ?? 'Select piggy bank' : 'Select piggy bank'}
                </Button>
              }
            >
              {piggyBanks.map((pb) => (
                <Menu.Item
                  key={pb.id}
                  title={pb.name}
                  onPress={() => { setSelectedPiggyBank(pb.id); setMenuVisible(false); }}
                />
              ))}
            </Menu>
          </>
        )}

        <MoneyInput label="Amount" valueCents={amountCents} onChange={setAmountCents} error={errors.amount} />

        <TextInput
          label="Date (YYYY-MM-DD)"
          value={date}
          onChangeText={setDate}
          mode="outlined"
          style={{ backgroundColor: theme.colors.surface }}
        />

        <TextInput
          label="Note (optional)"
          value={note}
          onChangeText={setNote}
          mode="outlined"
          multiline
          style={{ backgroundColor: theme.colors.surface }}
        />

        <View style={{ height: 16 }} />
      </ScrollView>

      <View style={[styles.footer, { backgroundColor: theme.colors.surface, borderTopColor: theme.custom.cardBorder }]}>
        <Button mode="outlined" onPress={() => router.back()}>Cancel</Button>
        <Button mode="contained" onPress={handleSave} loading={saving} disabled={saving} style={styles.saveBtn}>
          Save Transfer
        </Button>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  scroll: { padding: 16, gap: 12 },
  label: { fontSize: 11, fontWeight: '700', letterSpacing: 1 },
  footer: { flexDirection: 'row', padding: 16, gap: 12, borderTopWidth: 1, justifyContent: 'flex-end' },
  saveBtn: { flex: 1 },
});
