import React from 'react';
import { View, StyleSheet } from 'react-native';
import { Text } from 'react-native-paper';
import { useAppTheme } from '@/hooks/useAppTheme';
import { formatCents } from '@/lib/money';

interface XpBarProps {
  totalXp: number;
  level: number;
  progress: number; // 0–1
  xpToNext: number;
}

export function XpBar({ totalXp, level, progress, xpToNext }: XpBarProps) {
  const theme = useAppTheme();

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.surface, borderColor: theme.custom.cardBorder }]}>
      <View style={styles.row}>
        <View style={[styles.levelBadge, { backgroundColor: theme.custom.xp }]}>
          <Text style={styles.levelText}>Lv.{level}</Text>
        </View>
        <View style={styles.info}>
          <Text style={[styles.xpText, { color: theme.colors.onSurface }]}>{totalXp} XP total</Text>
          <Text style={[styles.nextText, { color: theme.colors.onSurface + '77' }]}>
            {xpToNext} XP to level {level + 1}
          </Text>
        </View>
      </View>
      <View style={[styles.trackBg, { backgroundColor: theme.colors.outline + '44' }]}>
        <View
          style={[
            styles.trackFill,
            { backgroundColor: theme.custom.xp, width: `${Math.min(progress * 100, 100)}%` },
          ]}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    borderRadius: 12,
    borderWidth: 1,
    padding: 16,
    gap: 10,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  levelBadge: {
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  levelText: {
    color: '#fff',
    fontWeight: '800',
    fontSize: 15,
  },
  info: {
    flex: 1,
  },
  xpText: {
    fontSize: 14,
    fontWeight: '700',
  },
  nextText: {
    fontSize: 12,
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
});
