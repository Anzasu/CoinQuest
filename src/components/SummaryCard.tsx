import React from 'react';
import { View, TouchableOpacity, StyleSheet } from 'react-native';
import { Text, Surface } from 'react-native-paper';
import { useAppTheme } from '@/hooks/useAppTheme';
import { formatCents } from '@/lib/money';

interface SummaryCardProps {
  title: string;
  amount: number; // cents
  subtitle?: string;
  accentColor?: string;
  badge?: string;
  onPress?: () => void;
  rightElement?: React.ReactNode;
}

export function SummaryCard({
  title,
  amount,
  subtitle,
  accentColor,
  badge,
  onPress,
  rightElement,
}: SummaryCardProps) {
  const theme = useAppTheme();
  const accent = accentColor ?? theme.colors.primary;

  return (
    <TouchableOpacity onPress={onPress} activeOpacity={onPress ? 0.7 : 1} disabled={!onPress}>
      <Surface style={[styles.card, { backgroundColor: theme.colors.surface, borderColor: theme.custom.cardBorder }]}>
        <View style={[styles.accentBar, { backgroundColor: accent }]} />
        <View style={styles.content}>
          <View style={styles.header}>
            <Text style={[styles.title, { color: theme.colors.onSurface }]}>{title}</Text>
            {badge && (
              <View style={[styles.badge, { backgroundColor: accent + '22' }]}>
                <Text style={[styles.badgeText, { color: accent }]}>{badge}</Text>
              </View>
            )}
          </View>
          <Text style={[styles.amount, { color: accent }]}>{formatCents(amount)}</Text>
          {subtitle && (
            <Text style={[styles.subtitle, { color: theme.colors.onSurface + '99' }]}>{subtitle}</Text>
          )}
        </View>
        {rightElement && <View style={styles.right}>{rightElement}</View>}
      </Surface>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 12,
    borderWidth: 1,
    flexDirection: 'row',
    overflow: 'hidden',
    elevation: 2,
    marginBottom: 8,
  },
  accentBar: {
    width: 4,
  },
  content: {
    flex: 1,
    padding: 16,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  title: {
    fontSize: 14,
    fontWeight: '600',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
    opacity: 0.7,
  },
  amount: {
    fontSize: 24,
    fontWeight: '700',
    letterSpacing: -0.5,
  },
  subtitle: {
    fontSize: 12,
    marginTop: 4,
  },
  badge: {
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  badgeText: {
    fontSize: 11,
    fontWeight: '700',
  },
  right: {
    padding: 16,
    justifyContent: 'center',
  },
});
