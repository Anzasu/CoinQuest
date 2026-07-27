import React from 'react';
import { View, StyleSheet, TouchableOpacity } from 'react-native';
import { Text, Surface } from 'react-native-paper';
import { useAppTheme } from '@/hooks/useAppTheme';
import { formatCents } from '@/lib/money';

interface BudgetCardProps {
  limitCents: number | null;
  spentCents: number;
  onPress: () => void;
}

export function BudgetCard({ limitCents, spentCents, onPress }: BudgetCardProps) {
  const theme = useAppTheme();

  if (limitCents == null) {
    return (
      <TouchableOpacity onPress={onPress} activeOpacity={0.7}>
        <Surface style={[styles.card, { backgroundColor: theme.colors.surface, borderColor: theme.custom.cardBorder }]}>
          <Text style={[styles.title, { color: theme.colors.onSurface }]}>Monthly Budget</Text>
          <Text style={[styles.sub, { color: theme.colors.onSurface + '66' }]}>No budget set · tap to add</Text>
          <Text style={[styles.spent, { color: theme.colors.onSurface }]}>
            Spent: {formatCents(spentCents)}
          </Text>
        </Surface>
      </TouchableOpacity>
    );
  }

  const progress = Math.min(spentCents / limitCents, 1);
  const isOver = spentCents > limitCents;
  const trackColor = isOver ? theme.colors.error : theme.custom.partC;

  return (
    <TouchableOpacity onPress={onPress} activeOpacity={0.7}>
      <Surface style={[styles.card, { backgroundColor: theme.colors.surface, borderColor: isOver ? theme.colors.error : theme.custom.cardBorder }]}>
        <View style={styles.header}>
          <Text style={[styles.title, { color: theme.colors.onSurface }]}>Monthly Budget</Text>
          {isOver && (
            <View style={[styles.overBadge, { backgroundColor: theme.colors.error + '22' }]}>
              <Text style={[styles.overText, { color: theme.colors.error }]}>Over budget</Text>
            </View>
          )}
        </View>
        <View style={styles.amounts}>
          <Text style={[styles.spent, { color: isOver ? theme.colors.error : theme.colors.onSurface }]}>
            {formatCents(spentCents)}
          </Text>
          <Text style={[styles.limit, { color: theme.colors.onSurface + '66' }]}>
            / {formatCents(limitCents)}
          </Text>
        </View>
        <View style={[styles.trackBg, { backgroundColor: theme.colors.outline + '44' }]}>
          <View style={[styles.trackFill, { backgroundColor: trackColor, width: `${progress * 100}%` }]} />
        </View>
        <Text style={[styles.remaining, { color: isOver ? theme.colors.error : theme.custom.partC }]}>
          {isOver
            ? `${formatCents(spentCents - limitCents)} over limit`
            : `${formatCents(limitCents - spentCents)} remaining`}
        </Text>
      </Surface>
    </TouchableOpacity>
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
  overBadge: {
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  overText: {
    fontSize: 11,
    fontWeight: '700',
  },
  amounts: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 4,
  },
  spent: {
    fontSize: 24,
    fontWeight: '700',
  },
  limit: {
    fontSize: 16,
  },
  trackBg: {
    height: 8,
    borderRadius: 4,
    overflow: 'hidden',
  },
  trackFill: {
    height: '100%',
    borderRadius: 4,
  },
  remaining: {
    fontSize: 12,
    fontWeight: '600',
  },
  sub: {
    fontSize: 12,
  },
});
