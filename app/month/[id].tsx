import React, { useCallback, useState } from 'react';
import { View, ScrollView, StyleSheet, Alert } from 'react-native';
import { Text, Appbar, Chip, Button, Surface, Divider } from 'react-native-paper';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useFocusEffect } from '@react-navigation/native';
import { useAppTheme } from '@/hooks/useAppTheme';
import { usePeriods } from '@/hooks/usePeriods';
import { useExpenses } from '@/hooks/useExpenses';
import { useTransfers } from '@/hooks/useTransfers';
import { useDonation } from '@/hooks/useDonation';
import { useExternalIncome } from '@/hooks/useExternalIncome';
import { useLegacyImport } from '@/hooks/useLegacyImport';
import { formatCents } from '@/lib/money';
import { formatDateDisplay, formatMonthYear } from '@/lib/dates';
import { EmptyState } from '@/components/EmptyState';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { db } from '@/db';
import { ledgerParts as ledgerPartsTable } from '@/db/schema';
import type { Period, LedgerPart } from '@/hooks/usePeriods';
import type { Expense } from '@/hooks/useExpenses';
import type { Transfer } from '@/hooks/useTransfers';
import type { ExternalIncome } from '@/hooks/useExternalIncome';

type Tab = 'A' | 'B' | 'C' | 'D' | 'budget' | 'donation' | 'income';

export default function MonthDetailScreen() {
  const { id, tab: initialTab } = useLocalSearchParams<{ id: string; tab?: string }>();
  const theme = useAppTheme();
  const router = useRouter();
  const { getPeriod, getLedgerParts, closePeriod, reopenPeriod } = usePeriods();
  const { getExpensesForPeriod, deleteExpense } = useExpenses();
  const { getTransfersForPeriod, deleteTransfer } = useTransfers();
  const { getDonationRecord, completeDonation, undoDonation } = useDonation();
  const { getForPeriod, deleteExternalIncome } = useExternalIncome();
  const { getLegacyTotals } = useLegacyImport();
  const [period, setPeriod] = useState<Period | null>(null);
  const [parts, setParts] = useState<LedgerPart[]>([]);
  const [overallInAccount, setOverallInAccount] = useState<Record<string, number>>({ A: 0, B: 0, C: 0, D: 0 });
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [transfers, setTransfers] = useState<Transfer[]>([]);
  const [income, setIncome] = useState<ExternalIncome[]>([]);
  const [donation, setDonation] = useState<any>(null);
  const [tab, setTab] = useState<Tab>((initialTab as Tab) ?? 'D');
  const [closeDialog, setCloseDialog] = useState(false);

  const periodId = Number(id);

  useFocusEffect(
    useCallback(() => {
      async function load() {
        const p = await getPeriod(periodId);
        if (!p) return;
        setPeriod(p);
        const pts = await getLedgerParts(periodId);
        setParts(pts);
        const exps = await getExpensesForPeriod(periodId);
        setExpenses(exps);
        const txns = await getTransfersForPeriod(periodId);
        setTransfers(txns);
        const don = await getDonationRecord(periodId);
        setDonation(don);
        const inc = await getForPeriod(periodId);
        setIncome(inc);

        // Compute overall_in_account per part:
        // overall = sum of monthlyTotalCents across ALL periods + legacy imports
        // overall_in_account = overall - spentAmountCents_sum - transferredOutAmountCents_sum - withdrawnCashAmountCents_sum
        const allRows = await db.select().from(ledgerPartsTable);
        const legacy = await getLegacyTotals();
        const oia: Record<string, number> = { A: 0, B: 0, C: 0, D: 0 };
        for (const partKey of ['A', 'B', 'C', 'D'] as const) {
          const rows = allRows.filter((r) => r.partType === partKey);
          const overall = rows.reduce((s, r) => s + r.monthlyTotalCents, 0) + (legacy[partKey] ?? 0);
          const spent = rows.reduce((s, r) => s + r.spentAmountCents, 0);
          const transferred = rows.reduce((s, r) => s + r.transferredOutAmountCents, 0);
          const withdrawn = rows.reduce((s, r) => s + r.withdrawnCashAmountCents, 0);
          oia[partKey] = overall - spent - transferred - withdrawn;
        }
        setOverallInAccount(oia);
      }
      load();
    }, [periodId]),
  );

  const getPart = (type: string) => parts.find((p) => p.partType === type);

  async function handleClose() {
    if (!period) return;
    await closePeriod(periodId);
    const updated = await getPeriod(periodId);
    setPeriod(updated ?? null);
    setCloseDialog(false);
  }

  async function handleReopen() {
    await reopenPeriod(periodId);
    const updated = await getPeriod(periodId);
    setPeriod(updated ?? null);
  }

  if (!period) return null;

  const tabs: { key: Tab; label: string }[] = [
    { key: 'D', label: 'Spending' },
    { key: 'A', label: 'B&M Savings' },
    { key: 'B', label: 'B&M Expenses' },
    { key: 'C', label: 'Emergency Fund' },
    { key: 'income', label: 'Income' },
    { key: 'budget', label: 'Budget' },
    { key: 'donation', label: 'Donation' },
  ];

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <Appbar.Header style={{ backgroundColor: theme.colors.surface }}>
        <Appbar.BackAction onPress={() => router.back()} color={theme.colors.primary} />
        <Appbar.Content title={formatMonthYear(period.month, period.year)} subtitle={period.status === 'closed' ? 'Closed' : 'Open'} color={theme.colors.onSurface} />
        {period.status === 'open' ? (
          <Appbar.Action icon="lock" onPress={() => setCloseDialog(true)} color={theme.colors.primary} />
        ) : (
          <Appbar.Action icon="lock-open" onPress={handleReopen} color={theme.colors.primary} />
        )}
        <Appbar.Action icon="plus" onPress={() => router.push({ pathname: '/expenses/add', params: { periodId } })} color={theme.colors.primary} />
        <Appbar.Action icon="bank-transfer" onPress={() => router.push({ pathname: '/transfers/add', params: { periodId } })} color={theme.colors.primary} />
      </Appbar.Header>

      {/* Tab strip */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={[styles.tabStrip, { backgroundColor: theme.colors.surface }]} contentContainerStyle={styles.tabContent}>
        {tabs.map((t) => (
          <Chip
            key={t.key}
            selected={tab === t.key}
            onPress={() => setTab(t.key)}
            compact
            style={{ backgroundColor: tab === t.key ? theme.colors.primary + '22' : 'transparent' }}
            textStyle={{ color: tab === t.key ? theme.colors.primary : theme.colors.onSurface + '77' }}
          >
            {t.label}
          </Chip>
        ))}
      </ScrollView>

      <ScrollView style={{ flex: 1 }} contentContainerStyle={styles.scroll}>
        {(tab === 'A' || tab === 'B' || tab === 'C' || tab === 'D') && (
          <PartDetailView
            part={getPart(tab)}
            tab={tab}
            expenses={tab === 'D' ? expenses : []}
            transfers={transfers.filter((t) => t.sourcePart === tab)}
            theme={theme}
            period={period}
            overallInAccount={overallInAccount[tab] ?? 0}
            onDeleteExpense={async (id) => { await deleteExpense(id); setExpenses(await getExpensesForPeriod(periodId)); }}
            onDeleteTransfer={async (id) => { await deleteTransfer(id); setTransfers(await getTransfersForPeriod(periodId)); }}
            router={router}
            periodId={periodId}
          />
        )}

        {tab === 'income' && (
          <IncomeView
            income={income}
            theme={theme}
            onDelete={async (id) => { await deleteExternalIncome(id); setIncome(await getForPeriod(periodId)); }}
            onAdd={() => router.push({ pathname: '/income/add', params: { periodId } })}
          />
        )}

        {tab === 'donation' && (
          <DonationView donation={donation} theme={theme} onComplete={() => completeDonation(periodId).then(() => getDonationRecord(periodId).then(setDonation))} onUndo={() => undoDonation(periodId).then(() => getDonationRecord(periodId).then(setDonation))} />
        )}

        {tab === 'budget' && <BudgetView period={period} theme={theme} router={router} periodId={periodId} />}

        <View style={{ height: 24 }} />
      </ScrollView>

      <ConfirmDialog
        visible={closeDialog}
        title="Close month?"
        message={`Close ${formatMonthYear(period.month, period.year)}? You can reopen this month later for corrections.`}
        confirmLabel="Close month"
        onConfirm={handleClose}
        onCancel={() => setCloseDialog(false)}
      />
    </View>
  );
}

function PartDetailView({ part, tab, expenses, transfers, theme, period, overallInAccount, onDeleteExpense, onDeleteTransfer, router, periodId }: any) {
  const partColors = { A: theme.custom.partA, B: theme.custom.partB, C: theme.custom.partC, D: theme.custom.partD };
  const color = partColors[tab as 'A' | 'B' | 'C' | 'D'];

  // Category spending breakdown for Part D
  const categoryTotals: Record<string, number> = {};
  if (tab === 'D') {
    for (const e of expenses as Expense[]) {
      categoryTotals[e.category] = (categoryTotals[e.category] ?? 0) + e.amountCents;
    }
  }
  const categoryRows = Object.entries(categoryTotals).sort((a, b) => b[1] - a[1]);
  const maxCat = categoryRows.length > 0 ? categoryRows[0][1] : 1;

  return (
    <View style={{ gap: 8 }}>
      <Surface style={[styles.partSummary, { backgroundColor: theme.colors.surface, borderColor: theme.custom.cardBorder }]}>
        <Text style={[styles.balanceLabel, { color: theme.colors.onSurface + '77' }]}>Overall in account</Text>
        <Text style={[styles.balance, { color }]}>{formatCents(overallInAccount)}</Text>
        <View style={styles.statRow}>
          <Stat label="This month" value={part?.monthlyTotalCents ?? 0} theme={theme} />
          {(tab === 'A' || tab === 'B') && (
            <>
              <Stat label="Transferred" value={part?.transferredOutAmountCents ?? 0} theme={theme} negative />
              <Stat label="Cash out" value={part?.withdrawnCashAmountCents ?? 0} theme={theme} negative />
            </>
          )}
          {tab === 'C' && <Stat label="Cash out" value={part?.withdrawnCashAmountCents ?? 0} theme={theme} negative />}
          {tab === 'D' && (
            <>
              <Stat label="Spent" value={part?.spentAmountCents ?? 0} theme={theme} negative />
              <Stat label="Cash out" value={part?.withdrawnCashAmountCents ?? 0} theme={theme} negative />
            </>
          )}
        </View>
      </Surface>

      {tab === 'D' && categoryRows.length > 0 && (
        <>
          <Text style={[styles.sectionLabel, { color: theme.colors.onBackground + '77' }]}>SPENDING BY CATEGORY</Text>
          <Surface style={[styles.partSummary, { backgroundColor: theme.colors.surface, borderColor: theme.custom.cardBorder, gap: 8 }]}>
            {categoryRows.map(([cat, cents]) => (
              <View key={cat} style={styles.catRow}>
                <Text style={[styles.catLabel, { color: theme.colors.onSurface + '99' }]}>{cat}</Text>
                <View style={styles.catBarWrap}>
                  <View style={[styles.catBar, { width: `${Math.round((cents / maxCat) * 100)}%`, backgroundColor: color }]} />
                </View>
                <Text style={[styles.catValue, { color: theme.colors.onSurface }]}>{formatCents(cents)}</Text>
              </View>
            ))}
          </Surface>
        </>
      )}

      {tab === 'D' && expenses.length > 0 && (
        <>
          <Text style={[styles.sectionLabel, { color: theme.colors.onBackground + '77' }]}>EXPENSES</Text>
          {expenses.map((e: Expense) => (
            <ExpenseRow key={e.id} expense={e} theme={theme} onDelete={() => onDeleteExpense(e.id)} />
          ))}
        </>
      )}

      {transfers.length > 0 && (
        <>
          <Text style={[styles.sectionLabel, { color: theme.colors.onBackground + '77' }]}>TRANSFERS & WITHDRAWALS</Text>
          {transfers.map((t: Transfer) => (
            <TransferRow key={t.id} transfer={t} theme={theme} onDelete={() => onDeleteTransfer(t.id)} />
          ))}
        </>
      )}

      {tab === 'D' && expenses.length === 0 && transfers.length === 0 && (
        <EmptyState icon="receipt" title="No transactions yet" description="Add an expense using the + button above." />
      )}
    </View>
  );
}

function Stat({ label, value, theme, negative }: any) {
  return (
    <View style={{ alignItems: 'center' }}>
      <Text style={{ fontSize: 11, color: theme.colors.onSurface + '77' }}>{label}</Text>
      <Text style={{ fontSize: 14, fontWeight: '700', color: negative ? theme.colors.error : theme.colors.onSurface }}>
        {formatCents(value)}
      </Text>
    </View>
  );
}

function ExpenseRow({ expense, theme, onDelete }: { expense: Expense; theme: any; onDelete: () => void }) {
  return (
    <Surface style={[styles.txnRow, { backgroundColor: theme.colors.surface, borderColor: theme.custom.cardBorder }]}>
      <View style={styles.txnContent}>
        <Text style={[styles.txnTitle, { color: theme.colors.onSurface }]}>{expense.category}</Text>
        <Text style={[styles.txnMeta, { color: theme.colors.onSurface + '66' }]}>
          {formatDateDisplay(expense.date)} · {expense.paymentMethod}
          {expense.note ? ` · ${expense.note}` : ''}
        </Text>
      </View>
      <Text style={[styles.txnAmount, { color: theme.colors.error }]}>-{formatCents(expense.amountCents)}</Text>
      <Text style={[styles.deleteBtn, { color: theme.colors.error + '77' }]} onPress={onDelete}>✕</Text>
    </Surface>
  );
}

function TransferRow({ transfer, theme, onDelete }: { transfer: Transfer; theme: any; onDelete: () => void }) {
  const typeLabels: Record<string, string> = {
    AtoExternal: 'Transfer out', BtoExternal: 'Transfer out',
    ACashWithdrawal: 'Cash withdrawal', BCashWithdrawal: 'Cash withdrawal',
    CCashWithdrawal: 'Cash withdrawal', DCashWithdrawal: 'Cash withdrawal',
    DtoPiggyBank: 'To piggy bank',
  };
  return (
    <Surface style={[styles.txnRow, { backgroundColor: theme.colors.surface, borderColor: theme.custom.cardBorder }]}>
      <View style={styles.txnContent}>
        <Text style={[styles.txnTitle, { color: theme.colors.onSurface }]}>{typeLabels[transfer.transferType] ?? transfer.transferType}</Text>
        <Text style={[styles.txnMeta, { color: theme.colors.onSurface + '66' }]}>
          {formatDateDisplay(transfer.date)}{transfer.note ? ` · ${transfer.note}` : ''}
        </Text>
      </View>
      <Text style={[styles.txnAmount, { color: theme.custom.transfer }]}>-{formatCents(transfer.amountCents)}</Text>
      <Text style={[styles.deleteBtn, { color: theme.colors.error + '77' }]} onPress={onDelete}>✕</Text>
    </Surface>
  );
}

function IncomeView({ income, theme, onDelete, onAdd }: any) {
  return (
    <View style={{ gap: 8 }}>
      <Button mode="contained" icon="plus" onPress={onAdd} style={{ alignSelf: 'flex-end', marginBottom: 8 }}>Add Income</Button>
      {income.length === 0 ? (
        <EmptyState icon="cash-plus" title="No external income" description="Add refunds, gifts, or side income." />
      ) : (
        income.map((i: any) => (
          <Surface key={i.id} style={[styles.txnRow, { backgroundColor: theme.colors.surface, borderColor: theme.custom.cardBorder }]}>
            <View style={styles.txnContent}>
              <Text style={[styles.txnTitle, { color: theme.colors.onSurface }]}>{i.type}</Text>
              <Text style={[styles.txnMeta, { color: theme.colors.onSurface + '66' }]}>{formatDateDisplay(i.date)}{i.note ? ` · ${i.note}` : ''}</Text>
            </View>
            <Text style={[styles.txnAmount, { color: theme.custom.income }]}>+{formatCents(i.amountCents)}</Text>
            <Text style={[styles.deleteBtn, { color: theme.colors.error + '77' }]} onPress={() => onDelete(i.id)}>✕</Text>
          </Surface>
        ))
      )}
    </View>
  );
}

function DonationView({ donation, theme, onComplete, onUndo }: any) {
  if (!donation) return <EmptyState icon="hand-heart" title="No donation record" description="Start a new month to create a donation record." />;
  const statusColor = donation.status === 'completed' ? theme.custom.partC : donation.status === 'missed' ? theme.colors.error : theme.custom.partD;
  return (
    <Surface style={[styles.donationCard, { backgroundColor: theme.colors.surface, borderColor: statusColor }]}>
      <Text style={[styles.donLabel, { color: theme.colors.onSurface + '77' }]}>Donation goal</Text>
      <Text style={[styles.donAmount, { color: statusColor }]}>{formatCents(donation.requiredAmountCents)}</Text>
      <Text style={[styles.donStatus, { color: statusColor }]}>{donation.status === 'completed' ? '✓ Completed' : donation.status === 'missed' ? 'Missed' : 'Pending'}</Text>
      {donation.status === 'pending' && <Button mode="contained" onPress={onComplete} style={{ marginTop: 8 }}>Mark as Donated</Button>}
      {donation.status === 'completed' && <Button mode="text" onPress={onUndo} style={{ marginTop: 4 }}>Undo</Button>}
    </Surface>
  );
}

function BudgetView({ period, theme, router, periodId }: any) {
  return (
    <View style={{ gap: 8 }}>
      <Button mode="contained" icon="plus" onPress={() => router.push({ pathname: '/budgets/add', params: { periodId } })} style={{ alignSelf: 'flex-end', marginBottom: 8 }}>Add Category Budget</Button>
      <Surface style={[styles.donationCard, { backgroundColor: theme.colors.surface, borderColor: theme.custom.cardBorder }]}>
        <Text style={[styles.donLabel, { color: theme.colors.onSurface + '77' }]}>Overall budget</Text>
        <Text style={[styles.donAmount, { color: theme.colors.onSurface }]}>
          {period.monthlyBudgetLimitCents != null ? formatCents(period.monthlyBudgetLimitCents) : 'Not set'}
        </Text>
        <Text style={[styles.donStatus, { color: theme.colors.onSurface + '66' }]}>
          Spent: {formatCents(period.monthlySpentCents)}
          {period.monthlyBudgetLimitCents != null
            ? `  ·  ${period.monthlySpentCents <= period.monthlyBudgetLimitCents ? 'Under budget ✓' : 'Over budget'}`
            : ''}
        </Text>
      </Surface>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  tabStrip: { flexGrow: 0, flexShrink: 0, borderBottomWidth: 1 },
  tabContent: { flexDirection: 'row', gap: 8, padding: 8 },
  scroll: { padding: 16, gap: 8 },
  partSummary: { borderRadius: 12, borderWidth: 1, padding: 16, gap: 8 },
  balanceLabel: { fontSize: 12, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.5 },
  balance: { fontSize: 32, fontWeight: '800' },
  statRow: { flexDirection: 'row', gap: 24, flexWrap: 'wrap' },
  sectionLabel: { fontSize: 11, fontWeight: '700', letterSpacing: 1, marginTop: 8 },
  txnRow: {
    borderRadius: 10,
    borderWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    gap: 8,
  },
  txnContent: { flex: 1 },
  txnTitle: { fontSize: 14, fontWeight: '600' },
  txnMeta: { fontSize: 12, marginTop: 2 },
  txnAmount: { fontSize: 14, fontWeight: '700' },
  deleteBtn: { fontSize: 18, paddingHorizontal: 4 },
  catRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  catLabel: { fontSize: 12, width: 90 },
  catBarWrap: { flex: 1, height: 10, backgroundColor: '#00000011', borderRadius: 5, overflow: 'hidden' },
  catBar: { height: 10, borderRadius: 5 },
  catValue: { fontSize: 12, fontWeight: '700', width: 72, textAlign: 'right' },
  donationCard: { borderRadius: 12, borderWidth: 1, padding: 20, gap: 8 },
  donLabel: { fontSize: 12, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.5 },
  donAmount: { fontSize: 32, fontWeight: '800' },
  donStatus: { fontSize: 14, fontWeight: '600' },
});
