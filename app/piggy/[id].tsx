import React, { useCallback, useState } from 'react';
import { View, ScrollView, StyleSheet, Alert } from 'react-native';
import { Text, Appbar, Button, Surface, SegmentedButtons, Dialog, Portal } from 'react-native-paper';
import { TextInput as RNTextInput } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useFocusEffect } from '@react-navigation/native';
import { useAppTheme } from '@/hooks/useAppTheme';
import { usePiggyBanks, type PiggyBank, type PiggyBankTransaction } from '@/hooks/usePiggyBanks';
import { usePeriods } from '@/hooks/usePeriods';
import { MoneyInput } from '@/components/MoneyInput';
import { EmptyState } from '@/components/EmptyState';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { formatCents } from '@/lib/money';
import { formatDateDisplay, todayIso } from '@/lib/dates';
import { db } from '@/db';
import { piggyBanks as piggyBanksTable, piggyBankTransactions } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { nowIso } from '@/lib/dates';

type ActionType = 'add' | 'spend' | 'transfer';

export default function PiggyBankDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const theme = useAppTheme();
  const router = useRouter();
  const { getPiggyBank, getTransactions, spendFromPiggyBank, archivePiggyBank, unarchivePiggyBank, deleteTransaction, transferBetweenPiggyBanks, getAllPiggyBanks } = usePiggyBanks();
  const { getAllPeriods } = usePeriods();

  const [pb, setPb] = useState<PiggyBank | null>(null);
  const [allBanks, setAllBanks] = useState<PiggyBank[]>([]);
  const [transactions, setTransactions] = useState<PiggyBankTransaction[]>([]);
  const [actionDialog, setActionDialog] = useState<ActionType | null>(null);
  const [actionAmount, setActionAmount] = useState<number | null>(null);
  const [actionNote, setActionNote] = useState('');
  const [actionBalanceType, setActionBalanceType] = useState<'account' | 'cash'>('account');
  const [transferTargetId, setTransferTargetId] = useState<number | null>(null);
  const [archiveDialog, setArchiveDialog] = useState(false);
  const [unarchiveDialog, setUnarchiveDialog] = useState(false);
  const [deleteDialog, setDeleteDialog] = useState(false);
  const [revertTxnId, setRevertTxnId] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);

  const pbId = Number(id);

  async function reload() {
    const bank = await getPiggyBank(pbId);
    setPb(bank ?? null);
    const txns = await getTransactions(pbId);
    setTransactions(txns);
    const banks = await getAllPiggyBanks();
    setAllBanks(banks.filter((b) => b.id !== pbId && !b.isArchived));
  }

  useFocusEffect(useCallback(() => { reload(); }, [pbId]));

  async function handleAction() {
    if (!actionAmount || actionAmount <= 0 || !pb) return;
    setSaving(true);
    try {
      const periods = await getAllPeriods();
      const now = new Date();
      const curMonth = now.getMonth() + 1;
      const curYear = now.getFullYear();
      const open = periods.find((p) => p.month === curMonth && p.year === curYear)
        ?? periods.find((p) => p.status === 'open')
        ?? periods[0];

      if (actionDialog === 'add') {
        await db.update(piggyBanksTable).set({
          totalAddedAllTimeCents: pb.totalAddedAllTimeCents + actionAmount,
          balanceCashCents: actionBalanceType === 'cash' ? pb.balanceCashCents + actionAmount : pb.balanceCashCents,
          balanceOnAccountCents: actionBalanceType === 'account' ? pb.balanceOnAccountCents + actionAmount : pb.balanceOnAccountCents,
        }).where(eq(piggyBanksTable.id, pbId));
        await db.insert(piggyBankTransactions).values({
          piggyBankId: pbId,
          date: todayIso(),
          amountCents: actionAmount,
          type: 'add',
          balanceType: actionBalanceType,
          note: actionNote.trim() || null,
          createdAt: nowIso(),
        });
      } else if (actionDialog === 'spend') {
        await spendFromPiggyBank({
          piggyBankId: pbId,
          periodId: open?.id ?? 0,
          amountCents: actionAmount,
          balanceType: actionBalanceType,
          date: todayIso(),
          note: actionNote.trim() || undefined,
        });
      } else if (actionDialog === 'transfer') {
        if (!transferTargetId) {
          Alert.alert('Select a target piggy bank');
          setSaving(false);
          return;
        }
        await transferBetweenPiggyBanks({
          fromId: pbId,
          toId: transferTargetId,
          amountCents: actionAmount,
          balanceType: actionBalanceType,
          date: todayIso(),
          note: actionNote.trim() || undefined,
        });
      }

      await reload();
      setActionDialog(null);
      setActionAmount(null);
      setActionNote('');
      setTransferTargetId(null);
    } catch (e: any) {
      Alert.alert('Error', e.message);
    } finally {
      setSaving(false);
    }
  }

  async function handleRevert() {
    if (!revertTxnId) return;
    setSaving(true);
    try {
      await deleteTransaction(revertTxnId);
      await reload();
    } catch (e: any) {
      Alert.alert('Error', e.message);
    } finally {
      setSaving(false);
      setRevertTxnId(null);
    }
  }

  async function handleArchive() {
    await archivePiggyBank(pbId);
    setArchiveDialog(false);
    await reload();
  }

  async function handleUnarchive() {
    await unarchivePiggyBank(pbId);
    setUnarchiveDialog(false);
    await reload();
  }

  async function handleDelete() {
    await db.delete(piggyBankTransactions).where(eq(piggyBankTransactions.piggyBankId, pbId));
    await db.delete(piggyBanksTable).where(eq(piggyBanksTable.id, pbId));
    setDeleteDialog(false);
    router.back();
  }

  if (!pb) return null;

  const totalBalance = pb.balanceOnAccountCents + pb.balanceCashCents;

  const ACTION_TITLES: Record<ActionType, string> = {
    add: 'Add funds',
    spend: 'Spend from piggy bank',
    transfer: 'Transfer to another piggy bank',
  };

  const revertTxn = revertTxnId != null ? transactions.find((t) => t.id === revertTxnId) : null;

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <Appbar.Header style={{ backgroundColor: theme.colors.surface }}>
        <Appbar.BackAction onPress={() => router.back()} color={theme.colors.primary} />
        <Appbar.Content title={pb.name} color={theme.colors.onSurface} />
        {!pb.isArchived && (
          <Appbar.Action icon="archive" onPress={() => setArchiveDialog(true)} color={theme.colors.primary} />
        )}
        {pb.isArchived && (
          <Appbar.Action icon="archive-off" onPress={() => setUnarchiveDialog(true)} color={theme.colors.primary} />
        )}
        <Appbar.Action icon="delete" onPress={() => setDeleteDialog(true)} color={theme.colors.error} />
      </Appbar.Header>

      <ScrollView contentContainerStyle={styles.scroll}>
        {/* Balance summary */}
        <Surface style={[styles.summary, { backgroundColor: theme.colors.surface, borderColor: theme.custom.cardBorder }]}>
          <Text style={[styles.balanceLabel, { color: theme.colors.onSurface + '77' }]}>Total balance</Text>
          <Text style={[styles.balance, { color: theme.colors.secondary }]}>{formatCents(totalBalance)}</Text>
          <View style={styles.balanceRow}>
            <View>
              <Text style={[styles.metaLabel, { color: theme.colors.onSurface + '66' }]}>On account</Text>
              <Text style={[styles.metaValue, { color: theme.colors.onSurface }]}>{formatCents(pb.balanceOnAccountCents)}</Text>
            </View>
            <View>
              <Text style={[styles.metaLabel, { color: theme.colors.onSurface + '66' }]}>Cash</Text>
              <Text style={[styles.metaValue, { color: theme.colors.onSurface }]}>{formatCents(pb.balanceCashCents)}</Text>
            </View>
            <View>
              <Text style={[styles.metaLabel, { color: theme.colors.onSurface + '66' }]}>Added all-time</Text>
              <Text style={[styles.metaValue, { color: theme.colors.onSurface }]}>{formatCents(pb.totalAddedAllTimeCents)}</Text>
            </View>
            <View>
              <Text style={[styles.metaLabel, { color: theme.colors.onSurface + '66' }]}>Spent all-time</Text>
              <Text style={[styles.metaValue, { color: theme.colors.error }]}>{formatCents(pb.totalSpentAllTimeCents)}</Text>
            </View>
          </View>
        </Surface>

        {/* Action buttons */}
        {!pb.isArchived && (
          <>
            <Text style={[styles.sectionLabel, { color: theme.colors.onBackground + '88' }]}>ACTIONS</Text>
            <View style={styles.actions}>
              <Button mode="contained" icon="plus" onPress={() => setActionDialog('add')} style={{ flex: 1 }} buttonColor={theme.custom.income}>
                Add
              </Button>
              <Button mode="contained" icon="cart" onPress={() => setActionDialog('spend')} style={{ flex: 1 }}>
                Spend
              </Button>
            </View>
            {allBanks.length > 0 && (
              <Button mode="outlined" icon="bank-transfer" onPress={() => setActionDialog('transfer')} style={{ marginTop: 4 }}>
                Transfer to another piggy bank
              </Button>
            )}
          </>
        )}

        {/* Transaction list */}
        <Text style={[styles.sectionLabel, { color: theme.colors.onBackground + '88' }]}>TRANSACTIONS</Text>
        {transactions.length === 0 ? (
          <EmptyState icon="piggy-bank" title="No transactions yet" />
        ) : (
          transactions.map((t) => (
            <Surface key={t.id} style={[styles.txnRow, { backgroundColor: theme.colors.surface, borderColor: theme.custom.cardBorder }]}>
              <View style={styles.txnContent}>
                <Text style={[styles.txnType, { color: theme.colors.onSurface }]}>
                  {t.type === 'add' ? '↓ Added' : t.type === 'remove' ? '↑ Removed' : '💸 Spent'}
                  {' · '}{t.balanceType}
                </Text>
                <Text style={[styles.txnMeta, { color: theme.colors.onSurface + '66' }]}>
                  {formatDateDisplay(t.date)}{t.note ? ` · ${t.note}` : ''}
                </Text>
              </View>
              <Text style={[styles.txnAmount, { color: t.type === 'add' ? theme.custom.income : theme.colors.error }]}>
                {t.type === 'add' ? '+' : '-'}{formatCents(t.amountCents)}
              </Text>
              <Text style={[styles.deleteBtn, { color: theme.colors.error + '88' }]} onPress={() => setRevertTxnId(t.id)}>✕</Text>
            </Surface>
          ))
        )}

        <View style={{ height: 24 }} />
      </ScrollView>

      {/* Add / Return / Spend / Transfer dialog */}
      <Portal>
        <Dialog visible={!!actionDialog} onDismiss={() => { setActionDialog(null); setTransferTargetId(null); }}>
          <Dialog.Title>{actionDialog ? ACTION_TITLES[actionDialog] : ''}</Dialog.Title>
          <Dialog.Content style={{ gap: 12 }}>
            <MoneyInput label="Amount" valueCents={actionAmount} onChange={setActionAmount} />
            {actionDialog === 'transfer' ? (
              <>
                <Text style={{ color: theme.colors.onSurface + '77', fontSize: 13 }}>Transfer to</Text>
                {allBanks.map((b) => (
                  <Button
                    key={b.id}
                    mode={transferTargetId === b.id ? 'contained' : 'outlined'}
                    onPress={() => setTransferTargetId(b.id)}
                    style={{ marginBottom: 4 }}
                  >
                    {b.name}
                  </Button>
                ))}
              </>
            ) : null}
            <Text style={{ color: theme.colors.onSurface + '77', fontSize: 13 }}>
              {actionDialog === 'add' ? 'How was it added?' : 'Balance source'}
            </Text>
            <SegmentedButtons
              value={actionBalanceType}
              onValueChange={(v) => setActionBalanceType(v as 'account' | 'cash')}
              buttons={[
                { value: 'account', label: 'Account / Card' },
                { value: 'cash', label: 'Cash' },
              ]}
            />
            <RNTextInput
              value={actionNote}
              onChangeText={setActionNote}
              placeholder="Note (optional)"
              placeholderTextColor={theme.colors.onSurface + '55'}
              style={{
                borderWidth: 1,
                borderColor: theme.custom.cardBorder,
                borderRadius: 8,
                padding: 12,
                fontSize: 16,
                color: theme.colors.onSurface,
                backgroundColor: theme.colors.surface,
              }}
            />
          </Dialog.Content>
          <Dialog.Actions>
            <Button onPress={() => { setActionDialog(null); setTransferTargetId(null); }}>Cancel</Button>
            <Button onPress={handleAction} loading={saving} disabled={saving || !actionAmount || (actionDialog === 'transfer' && !transferTargetId)}>
              Confirm
            </Button>
          </Dialog.Actions>
        </Dialog>
      </Portal>

      <ConfirmDialog
        visible={revertTxnId != null}
        title="Revert transaction?"
        message={revertTxn ? `Revert ${revertTxn.type} of ${formatCents(revertTxn.amountCents)}? This will undo the balance change.` : ''}
        confirmLabel="Revert"
        onConfirm={handleRevert}
        onCancel={() => setRevertTxnId(null)}
      />

      <ConfirmDialog
        visible={archiveDialog}
        title="Archive piggy bank?"
        message={`Archive "${pb.name}"? You can unarchive it at any time.`}
        confirmLabel="Archive"
        onConfirm={handleArchive}
        onCancel={() => setArchiveDialog(false)}
      />

      <ConfirmDialog
        visible={unarchiveDialog}
        title="Unarchive piggy bank?"
        message={`Restore "${pb.name}" to active status?`}
        confirmLabel="Unarchive"
        onConfirm={handleUnarchive}
        onCancel={() => setUnarchiveDialog(false)}
      />

      <ConfirmDialog
        visible={deleteDialog}
        title="Delete piggy bank?"
        message={`Permanently delete "${pb.name}" and all its transactions? This cannot be undone.`}
        confirmLabel="Delete"
        onConfirm={handleDelete}
        onCancel={() => setDeleteDialog(false)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  scroll: { padding: 16, gap: 8 },
  summary: { borderRadius: 12, borderWidth: 1, padding: 16, gap: 8, marginBottom: 4 },
  balanceLabel: { fontSize: 12, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.5 },
  balance: { fontSize: 36, fontWeight: '800' },
  balanceRow: { flexDirection: 'row', gap: 16, flexWrap: 'wrap', marginTop: 4 },
  metaLabel: { fontSize: 11 },
  metaValue: { fontSize: 14, fontWeight: '700' },
  sectionLabel: { fontSize: 11, fontWeight: '700', letterSpacing: 1, marginTop: 8 },
  actions: { flexDirection: 'row', gap: 8 },
  txnRow: { borderRadius: 10, borderWidth: 1, flexDirection: 'row', alignItems: 'center', padding: 12, gap: 8 },
  txnContent: { flex: 1 },
  txnType: { fontSize: 14, fontWeight: '600' },
  txnMeta: { fontSize: 12, marginTop: 2 },
  txnAmount: { fontSize: 14, fontWeight: '700' },
  deleteBtn: { fontSize: 18, paddingHorizontal: 4 },
});
