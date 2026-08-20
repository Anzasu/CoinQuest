import React, { useState } from 'react';
import { View, ScrollView, StyleSheet, Alert } from 'react-native';
import { Text, Button, Appbar, TextInput } from 'react-native-paper';
import { useRouter } from 'expo-router';
import { useAppTheme } from '@/hooks/useAppTheme';
import { usePiggyBanks } from '@/hooks/usePiggyBanks';
import { MoneyInput } from '@/components/MoneyInput';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export default function NewPiggyBankScreen() {
  const theme = useAppTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { createPiggyBank } = usePiggyBanks();

  const [name, setName] = useState('');
  const [openingCash, setOpeningCash] = useState<number | null>(null);
  const [openingAccount, setOpeningAccount] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);
  const [nameError, setNameError] = useState('');

  async function handleSave() {
    if (!name.trim()) {
      setNameError('Enter a name for this piggy bank');
      return;
    }
    setNameError('');
    setSaving(true);

    try {
      await createPiggyBank({
        name: name.trim(),
        openingCashBalanceCents: openingCash ?? 0,
        openingAccountBalanceCents: openingAccount ?? 0,
      });
      router.back();
    } catch (e: any) {
      Alert.alert('Error', e.message ?? 'Could not create piggy bank');
    } finally {
      setSaving(false);
    }
  }

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <Appbar.Header style={{ backgroundColor: theme.colors.surface }}>
        <Appbar.BackAction onPress={() => router.back()} />
        <Appbar.Content title="New Piggy Bank" />
      </Appbar.Header>

      <ScrollView contentContainerStyle={styles.scroll}>
        <TextInput
          label="Name"
          value={name}
          onChangeText={(t) => { setName(t); setNameError(''); }}
          mode="outlined"
          error={!!nameError}
          style={{ backgroundColor: theme.colors.surface }}
          placeholder="e.g. Vacation, New Phone, Emergency"
        />
        {nameError ? <Text style={{ color: theme.colors.error, fontSize: 12 }}>{nameError}</Text> : null}

        <Text style={[styles.hint, { color: theme.colors.onBackground + '77' }]}>
          Opening balances (optional)
        </Text>
        <Text style={[styles.hintSub, { color: theme.colors.onBackground + '55' }]}>
          If this piggy bank already has money in it, enter the existing amounts here.
          This does NOT deduct anything from Spending — it's setup data only.
        </Text>
        <MoneyInput label="Existing cash balance" valueCents={openingCash} onChange={setOpeningCash} />
        <MoneyInput label="Existing on account balance" valueCents={openingAccount} onChange={setOpeningAccount} />

        <View style={{ height: 16 }} />
      </ScrollView>

      <View style={[styles.footer, { backgroundColor: theme.colors.surface, borderTopColor: theme.custom.cardBorder, paddingBottom: 16 + insets.bottom }]}>
        <Button mode="outlined" onPress={() => router.back()}>Cancel</Button>
        <Button mode="contained" onPress={handleSave} loading={saving} disabled={saving} style={styles.saveBtn}>
          Create Piggy Bank
        </Button>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  scroll: { padding: 16, gap: 12 },
  hint: { fontSize: 14, fontWeight: '600', marginTop: 8 },
  hintSub: { fontSize: 13, lineHeight: 20, marginBottom: 4 },
  footer: { flexDirection: 'row', padding: 16, gap: 12, borderTopWidth: 1, justifyContent: 'flex-end' },
  saveBtn: { flex: 1 },
});
