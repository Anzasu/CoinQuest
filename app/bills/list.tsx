import React, { useCallback, useState } from 'react';
import { View, ScrollView, StyleSheet, Alert } from 'react-native';
import { Text, Appbar, FAB, Surface, Switch, IconButton, TextInput } from 'react-native-paper';
import { useRouter } from 'expo-router';
import { useFocusEffect } from '@react-navigation/native';
import { Dialog, Portal, Button } from 'react-native-paper';
import { useAppTheme } from '@/hooks/useAppTheme';
import { useBills, type BillTemplate } from '@/hooks/useBills';
import { MoneyInput } from '@/components/MoneyInput';
import { formatCents } from '@/lib/money';
import { EmptyState } from '@/components/EmptyState';

export default function BillsListScreen() {
  const theme = useAppTheme();
  const router = useRouter();
  const { getAllTemplates, createTemplate, updateTemplate, deleteTemplate } = useBills();

  const [templates, setTemplates] = useState<BillTemplate[]>([]);
  const [dialogVisible, setDialogVisible] = useState(false);
  const [editId, setEditId] = useState<number | null>(null);
  const [name, setName] = useState('');
  const [amountCents, setAmountCents] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);

  useFocusEffect(
    useCallback(() => {
      getAllTemplates().then(setTemplates);
    }, []),
  );

  function openAdd() {
    setEditId(null);
    setName('');
    setAmountCents(null);
    setDialogVisible(true);
  }

  function openEdit(t: BillTemplate) {
    setEditId(t.id);
    setName(t.name);
    setAmountCents(t.amountCents);
    setDialogVisible(true);
  }

  async function handleSave() {
    if (!name.trim() || !amountCents || amountCents <= 0) return;
    setSaving(true);
    try {
      if (editId) {
        const existing = templates.find((t) => t.id === editId);
        await updateTemplate(editId, { name: name.trim(), amountCents, isActive: existing?.isActive ?? true });
      } else {
        await createTemplate({ name: name.trim(), amountCents });
      }
      const updated = await getAllTemplates();
      setTemplates(updated);
      setDialogVisible(false);
    } finally {
      setSaving(false);
    }
  }

  async function handleToggle(t: BillTemplate) {
    await updateTemplate(t.id, { name: t.name, amountCents: t.amountCents, isActive: !t.isActive });
    const updated = await getAllTemplates();
    setTemplates(updated);
  }

  async function handleDelete(id: number) {
    Alert.alert('Delete bill?', 'This will remove the bill template. Past months are unaffected.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: async () => { await deleteTemplate(id); getAllTemplates().then(setTemplates); } },
    ]);
  }

  const total = templates.filter((t) => t.isActive).reduce((s, t) => s + t.amountCents, 0);

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <Appbar.Header style={{ backgroundColor: theme.colors.surface }}>
        <Appbar.BackAction onPress={() => router.back()} />
        <Appbar.Content title="Bill Templates" subtitle={`${templates.filter((t) => t.isActive).length} active · ${formatCents(total)}/month`} />
      </Appbar.Header>

      <ScrollView contentContainerStyle={styles.scroll}>
        {templates.length === 0 ? (
          <EmptyState icon="receipt" title="No bill templates" description="Add your recurring bills. They'll auto-fill when you start a new month." />
        ) : (
          templates.map((t) => (
            <Surface key={t.id} style={[styles.row, { backgroundColor: theme.colors.surface, borderColor: theme.custom.cardBorder, opacity: t.isActive ? 1 : 0.55 }]}>
              <Switch value={t.isActive} onValueChange={() => handleToggle(t)} color={theme.colors.primary} />
              <View style={{ flex: 1 }}>
                <Text style={[styles.billName, { color: theme.colors.onSurface }]}>{t.name}</Text>
                <Text style={[styles.billAmt, { color: theme.colors.onSurface + '77' }]}>{formatCents(t.amountCents)}/month</Text>
              </View>
              <IconButton icon="pencil" size={18} onPress={() => openEdit(t)} iconColor={theme.colors.primary} />
              <IconButton icon="delete" size={18} onPress={() => handleDelete(t.id)} iconColor={theme.colors.error + '88'} />
            </Surface>
          ))
        )}
        <View style={{ height: 80 }} />
      </ScrollView>

      <FAB icon="plus" style={[styles.fab, { backgroundColor: theme.colors.primary }]} color="#fff" onPress={openAdd} />

      <Portal>
        <Dialog visible={dialogVisible} onDismiss={() => setDialogVisible(false)}>
          <Dialog.Title>{editId ? 'Edit Bill' : 'Add Bill'}</Dialog.Title>
          <Dialog.Content style={{ gap: 12 }}>
            <TextInput label="Bill name" value={name} onChangeText={setName} mode="outlined" style={{ backgroundColor: theme.colors.surface }} />
            <MoneyInput label="Monthly amount" valueCents={amountCents} onChange={setAmountCents} />
          </Dialog.Content>
          <Dialog.Actions>
            <Button onPress={() => setDialogVisible(false)}>Cancel</Button>
            <Button onPress={handleSave} loading={saving} disabled={saving || !name.trim() || !amountCents}>Save</Button>
          </Dialog.Actions>
        </Dialog>
      </Portal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  scroll: { padding: 16, gap: 8 },
  row: { borderRadius: 10, borderWidth: 1, flexDirection: 'row', alignItems: 'center', padding: 12, gap: 8 },
  billName: { fontSize: 15, fontWeight: '600' },
  billAmt: { fontSize: 13 },
  fab: { position: 'absolute', right: 16, bottom: 16 },
});
