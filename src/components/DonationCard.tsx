import React, { useState } from 'react';
import { View, StyleSheet } from 'react-native';
import { Text, Surface, Button } from 'react-native-paper';
import { useAppTheme } from '@/hooks/useAppTheme';
import { formatCents } from '@/lib/money';
import type { DonationRecord } from '@/hooks/useDonation';
import { MoneyInput } from '@/components/MoneyInput';

interface DonationCardProps {
  record: DonationRecord | undefined;
  onComplete: (amountCents: number) => Promise<void>;
  onUndo: () => Promise<void>;
}

export function DonationCard({ record, onComplete, onUndo }: DonationCardProps) {
  const theme = useAppTheme();
  const [amountCents, setAmountCents] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);

  if (!record) {
    return (
      <Surface style={[styles.card, { backgroundColor: theme.colors.surface, borderColor: theme.custom.cardBorder }]}>
        <Text style={{ color: theme.colors.onSurface + '66' }}>No active month — start a new month to see the donation recommendation.</Text>
      </Surface>
    );
  }

  const isCompleted = record.status === 'completed';
  const isMissed = record.status === 'missed';
  const statusColor = isCompleted ? theme.custom.partC : isMissed ? theme.colors.error : theme.custom.partD;

  return (
    <Surface style={[styles.card, { backgroundColor: theme.colors.surface, borderColor: statusColor }]}>
        <View style={styles.header}>
          <Text style={[styles.title, { color: theme.colors.onSurface }]}>Monthly Donation</Text>
          <View style={[styles.status, { backgroundColor: statusColor + '22' }]}>
            <Text style={[styles.statusText, { color: statusColor }]}>
              {isCompleted ? 'Completed ✓' : isMissed ? 'Missed' : 'Pending'}
            </Text>
          </View>
        </View>
        <Text style={[styles.amount, { color: statusColor }]}>{formatCents(record.requiredAmountCents)}</Text>
        <Text style={[styles.sub, { color: theme.colors.onSurface + '66' }]}>
          Recommended amount (25% of Spending)
        </Text>
        {!isCompleted && !isMissed && (
          <>
            <MoneyInput label="Donation amount" valueCents={amountCents} onChange={setAmountCents} />
            <Button
              mode="contained"
              onPress={async () => {
                if (!amountCents || amountCents <= 0) return;
                setSaving(true);
                try {
                  await onComplete(amountCents);
                  setAmountCents(null);
                } catch {
                  // The parent displays the validation error.
                } finally {
                  setSaving(false);
                }
              }}
              style={styles.btn}
              compact
              loading={saving}
              disabled={saving || !amountCents || amountCents <= 0}
            >
              Donation done
            </Button>
          </>
        )}
        {isCompleted && (
          <Button
            mode="text"
            onPress={async () => {
              setSaving(true);
              try {
                await onUndo();
              } finally {
                setSaving(false);
              }
            }}
            style={styles.btn}
            compact
            textColor={theme.colors.onSurface + '66'}
            loading={saving}
            disabled={saving}
          >
            Undo
          </Button>
        )}
    </Surface>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 12,
    borderWidth: 1,
    padding: 16,
    gap: 8,
    elevation: 2,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  title: {
    fontSize: 14,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    opacity: 0.7,
  },
  status: {
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  statusText: {
    fontSize: 11,
    fontWeight: '700',
  },
  amount: {
    fontSize: 28,
    fontWeight: '700',
  },
  sub: {
    fontSize: 12,
  },
  btn: {
    marginTop: 4,
    alignSelf: 'flex-start',
  },
});
