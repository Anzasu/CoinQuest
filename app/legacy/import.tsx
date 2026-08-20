import React, { useCallback, useState } from 'react';
import { View, ScrollView, StyleSheet, Alert, TouchableOpacity, KeyboardAvoidingView, Platform } from 'react-native';
import { Text, Appbar, Button, Surface, Divider } from 'react-native-paper';
import { useRouter } from 'expo-router';
import { useFocusEffect } from '@react-navigation/native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useAppTheme } from '@/hooks/useAppTheme';
import { useLegacyImport } from '@/hooks/useLegacyImport';
import { MoneyInput } from '@/components/MoneyInput';
import { formatCents } from '@/lib/money';
import { formatDateDisplay } from '@/lib/dates';

const PART_LABELS: Record<string, string> = {
  A: 'B&M Savings',
  B: 'B&M Expenses',
  C: 'Emergency Fund',
  D: 'Spending',
};

export default function LegacyImportScreen() {
  const theme = useAppTheme();
  const router = useRouter();
  const { getAll, addImport, deleteImport } = useLegacyImport();

  const [imports, setImports] = useState<any[]>([]);
  const [amounts, setAmounts] = useState<Record<'A' | 'B' | 'C' | 'D', number | null>>({
    A: null, B: null, C: null, D: null,
  });
  const [saving, setSaving] = useState(false);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({ A: false, B: false, C: false, D: false });

  useFocusEffect(
    useCallback(() => {
      getAll().then(setImports);
    }, []),
  );

  async function handleImport(part: 'A' | 'B' | 'C' | 'D') {
    const amt = amounts[part];
    if (!amt || amt == 0) {
      Alert.alert('Invalid amount', 'Enter a valid amount for ' + PART_LABELS[part]);
      return;
    }
    setSaving(true);
    try {
      await addImport({ partType: part, amountCents: amt });
      // Reset input to null (empty) after successful add
      setAmounts((prev) => ({ ...prev, [part]: null }));
      const updated = await getAll();
      setImports(updated);
    } catch (e: any) {
      Alert.alert('Error', e.message);
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id: number) {
    try {
      await deleteImport(id);
      const updated = await getAll();
      setImports(updated);
    } catch (error: any) {
      Alert.alert('Legacy amount not deleted', error.message ?? 'Could not delete legacy amount');
    }
  }

  const groupedByPart = (['A', 'B', 'C', 'D'] as const).map((part) => ({
    part,
    records: imports.filter((r) => r.partType === part),
    total: imports.filter((r) => r.partType === part).reduce((s: number, r: any) => s + r.amountCents, 0),
  }));

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <Appbar.Header style={{ backgroundColor: theme.colors.surface }}>
        <Appbar.BackAction onPress={() => router.back()} color={theme.colors.primary} />
        <Appbar.Content title="Legacy Import" subtitle="Pre-app historical balances" color={theme.colors.onSurface} />
      </Appbar.Header>

      <KeyboardAvoidingView
        style={styles.keyboardArea}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
      <ScrollView
        contentContainerStyle={styles.scroll}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
      >
        <Surface style={[styles.infoBox, { backgroundColor: theme.colors.surfaceVariant, borderColor: theme.custom.cardBorder }]}>
          <Text style={[styles.infoTitle, { color: theme.colors.onSurface }]}>What is this?</Text>
          <Text style={[styles.infoText, { color: theme.colors.onSurface + '88' }]}>
            If you tracked parts before using this app, enter those historical totals here.
            These contribute to all-time totals but do NOT create monthly transactions or affect donations.
          </Text>
        </Surface>

        {groupedByPart.map(({ part, records, total }) => (
          <View key={part} style={styles.partSection}>
            <View style={styles.partHeader}>
              <View style={[styles.partBadge, { backgroundColor: theme.custom[`part${part}` as keyof typeof theme.custom] as string }]}>
                <Text style={styles.partLetter}>{part}</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[styles.partLabel, { color: theme.colors.onBackground }]}>{PART_LABELS[part]}</Text>
                <Text style={[styles.partTotal, { color: theme.colors.onBackground + '77' }]}>
                  Legacy total: {formatCents(total)}
                </Text>
              </View>
            </View>

            {/* Add row */}
            <View style={styles.addRow}>
              <View style={{ flex: 1 }}>
                <MoneyInput
                  label={`Add to ${PART_LABELS[part]}`}
                  valueCents={amounts[part]}
                  onChange={(v) => setAmounts((prev) => ({ ...prev, [part]: v }))}
                />
              </View>
              <Button mode="contained-tonal" onPress={() => handleImport(part)} loading={saving} compact style={{ alignSelf: 'flex-end' }}>
                Add
              </Button>
            </View>

            {/* Collapsible history */}
            {records.length > 0 && (
              <TouchableOpacity
                onPress={() => setExpanded((prev) => ({ ...prev, [part]: !prev[part] }))}
                style={[styles.historyToggle, { backgroundColor: theme.colors.surfaceVariant, borderRadius: 8 }]}
                activeOpacity={0.7}
              >
                <Text style={[styles.historyToggleText, { color: theme.colors.onSurface + '88' }]}>
                  History ({records.length} {records.length === 1 ? 'entry' : 'entries'})
                </Text>
                <MaterialCommunityIcons
                  name={expanded[part] ? 'chevron-up' : 'chevron-down'}
                  size={18}
                  color={theme.colors.onSurface + '77'}
                />
              </TouchableOpacity>
            )}

            {expanded[part] && records.map((r: any) => (
              <Surface key={r.id} style={[styles.record, { backgroundColor: theme.colors.surface, borderColor: theme.custom.cardBorder }]}>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.recordAmt, { color: theme.colors.onSurface }]}>{formatCents(r.amountCents)}</Text>
                  <Text style={[styles.recordDate, { color: theme.colors.onSurface + '66' }]}>
                    Imported {formatDateDisplay(r.dateImported)}{r.note ? ` · ${r.note}` : ''}
                  </Text>
                </View>
                <Text style={[styles.deleteBtn, { color: theme.colors.error + '88' }]} onPress={() => handleDelete(r.id)}>✕</Text>
              </Surface>
            ))}

            <Divider style={{ marginVertical: 8 }} />
          </View>
        ))}

        <View style={{ height: 48 }} />
      </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  keyboardArea: { flex: 1 },
  scroll: { padding: 16, gap: 8 },
  infoBox: { borderRadius: 12, borderWidth: 1, padding: 16, gap: 8, marginBottom: 8 },
  infoTitle: { fontSize: 15, fontWeight: '700' },
  infoText: { fontSize: 13, lineHeight: 20 },
  partSection: { gap: 8 },
  partHeader: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  partBadge: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  partLetter: { color: '#fff', fontSize: 16, fontWeight: '800' },
  partLabel: { fontSize: 16, fontWeight: '700' },
  partTotal: { fontSize: 13 },
  addRow: { flexDirection: 'row', gap: 12, alignItems: 'flex-start' },
  historyToggle: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 12, paddingVertical: 8 },
  historyToggleText: { fontSize: 13, fontWeight: '600' },
  record: { borderRadius: 10, borderWidth: 1, flexDirection: 'row', alignItems: 'center', padding: 12, gap: 8 },
  recordAmt: { fontSize: 15, fontWeight: '700' },
  recordDate: { fontSize: 12 },
  deleteBtn: { fontSize: 18, paddingHorizontal: 4 },
});
