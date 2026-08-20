import React from 'react';
import { View, TouchableOpacity, StyleSheet } from 'react-native';
import { Text, Surface } from 'react-native-paper';
import { useAppTheme } from '@/hooks/useAppTheme';
import { formatCents } from '@/lib/money';

interface PartCardProps {
  part: 'A' | 'B' | 'C' | 'D';
  label: string;
  description: string;
  currentBalance: number;
  monthlyBalance: number;
  onPress: () => void;
  extra?: { label: string; value: number }[];
}

const PART_DESCRIPTIONS: Record<string, string> = {
  A: 'Baba & Mama`s Savings',
  B: 'Baba & Mama`s Expense',
  C: 'Emergency fund',
  D: 'General spending',
};

export function PartCard({ part, label, description, currentBalance, monthlyBalance, onPress, extra }: PartCardProps) {
  const theme = useAppTheme();
  const colors = {
    A: theme.custom.partA,
    B: theme.custom.partB,
    C: theme.custom.partC,
    D: theme.custom.partD,
  };
  const color = colors[part];

  return (
    <TouchableOpacity onPress={onPress} activeOpacity={0.7}>
      <Surface style={[styles.card, { backgroundColor: theme.colors.surface, borderColor: theme.custom.cardBorder }]}>
        <View style={[styles.partBadge, { backgroundColor: color }]}>
          <Text style={styles.partLetter}>{part}</Text>
        </View>
        <View style={styles.content}>
          <Text style={[styles.label, { color: theme.colors.onSurface }]}>{label}</Text>
          <Text style={[styles.desc, { color: theme.colors.onSurface + '88' }]}>{description}</Text>
          <Text style={[styles.balance, { color }]}>{formatCents(currentBalance)}</Text>
          <Text style={[styles.monthly, { color: theme.colors.onSurface + '66' }]}>
            This month: {formatCents(monthlyBalance)}
          </Text>
          {extra?.map((e) => (
            <Text key={e.label} style={[styles.monthly, { color: theme.colors.onSurface + '66' }]}>
              {e.label}: {formatCents(e.value)}
            </Text>
          ))}
        </View>
        <Text style={[styles.chevron, { color: theme.colors.onSurface + '44' }]}>›</Text>
      </Surface>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 12,
    borderWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    gap: 12,
    elevation: 2,
    marginBottom: 8,
  },
  partBadge: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  partLetter: {
    color: '#fff',
    fontSize: 20,
    fontWeight: '800',
  },
  content: {
    flex: 1,
  },
  label: {
    fontSize: 16,
    fontWeight: '700',
  },
  desc: {
    fontSize: 12,
    marginBottom: 4,
  },
  balance: {
    fontSize: 22,
    fontWeight: '700',
  },
  monthly: {
    fontSize: 12,
    marginTop: 2,
  },
  chevron: {
    fontSize: 24,
    fontWeight: '300',
  },
});
