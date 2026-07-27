import React, { useCallback, useState } from 'react';
import { View, ScrollView, StyleSheet, TouchableOpacity } from 'react-native';
import { Text, Surface, Switch } from 'react-native-paper';
import { useRouter } from 'expo-router';
import { useFocusEffect } from '@react-navigation/native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useAppTheme } from '@/hooks/useAppTheme';
import { useSettingsStore } from '@/stores/settingsStore';
import { useGamification } from '@/hooks/useGamification';
import { XpBar } from '@/components/XpBar';
import { THEME_LABELS, type ThemeKey } from '@/theme/themes';
import { db } from '@/db';
import { appSettings, achievements } from '@/db/schema';
import { eq } from 'drizzle-orm';

const THEME_KEYS: ThemeKey[] = ['dark', 'light', 'babyPink', 'lightBrown', 'lightBlue', 'forestGreen'];

const THEME_COLORS: Record<ThemeKey, string> = {
  dark: '#e94560',
  light: '#2563eb',
  babyPink: '#d63384',
  lightBrown: '#7c5c3d',
  lightBlue: '#0369a1',
  forestGreen: '#2d6a4f',
};

export default function MoreScreen() {
  const theme = useAppTheme();
  const router = useRouter();
  const { theme: currentTheme, setTheme } = useSettingsStore();
  const { getGamificationStats } = useGamification();
  const [gamification, setGamification] = useState<any>(null);

  useFocusEffect(
    useCallback(() => {
      async function load() {
        const stats = await getGamificationStats();
        setGamification(stats);
      }
      load();
    }, []),
  );

  async function handleThemeChange(key: ThemeKey) {
    setTheme(key);
    await db
      .update(appSettings)
      .set({ theme: key, updatedAt: new Date().toISOString() })
      .where(eq(appSettings.id, 1));
  }

  const unlockedAchievements = gamification?.achievements?.filter((a: any) => a.isUnlocked) ?? [];

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <View style={styles.header}>
          <Text style={[styles.title, { color: theme.colors.onBackground }]}>More</Text>
        </View>

        {/* Gamification */}
        {gamification && (
          <>
            <Text style={[styles.section, { color: theme.colors.onBackground + '88' }]}>GAMIFICATION</Text>
            <XpBar
              totalXp={gamification.totalXp}
              level={gamification.level}
              progress={gamification.progress}
              xpToNext={gamification.xpToNextLevel}
            />

            <Text style={[styles.section, { color: theme.colors.onBackground + '88' }]}>
              ACHIEVEMENTS ({unlockedAchievements.length}/{gamification.achievements?.length ?? 0})
            </Text>
            {gamification.achievements?.map((a: any) => (
              <AchievementRow key={a.id} achievement={a} theme={theme} />
            ))}
          </>
        )}

        {/* Navigation shortcuts */}
        <Text style={[styles.section, { color: theme.colors.onBackground + '88' }]}>MANAGE</Text>

        <MenuRow
          icon="calendar-month"
          label="Monthly Periods"
          theme={theme}
          onPress={() => router.push('/month/list')}
        />
        <MenuRow
          icon="receipt"
          label="Bill Templates"
          theme={theme}
          onPress={() => router.push('/bills/list')}
        />
        <MenuRow
          icon="chart-bar"
          label="Budgets"
          theme={theme}
          onPress={() => router.push('/budgets/list')}
        />
        <MenuRow
          icon="history"
          label="Legacy Import (A–D)"
          theme={theme}
          onPress={() => router.push('/legacy/import')}
        />

        {/* Theme picker */}
        <Text style={[styles.section, { color: theme.colors.onBackground + '88' }]}>THEME</Text>
        <View style={styles.themeGrid}>
          {THEME_KEYS.map((key) => (
            <TouchableOpacity
              key={key}
              onPress={() => handleThemeChange(key)}
              style={[
                styles.themeChip,
                {
                  backgroundColor: THEME_COLORS[key] + '22',
                  borderColor: key === currentTheme ? THEME_COLORS[key] : 'transparent',
                  borderWidth: 2,
                },
              ]}
            >
              <View style={[styles.themeDot, { backgroundColor: THEME_COLORS[key] }]} />
              <Text style={[styles.themeLabel, { color: theme.colors.onBackground + '99' }]}>
                {THEME_LABELS[key]}
              </Text>
              {key === currentTheme && (
                <MaterialCommunityIcons name="check-circle" size={14} color={THEME_COLORS[key]} />
              )}
            </TouchableOpacity>
          ))}
        </View>

        <View style={{ height: 32 }} />
      </ScrollView>
    </View>
  );
}

function MenuRow({ icon, label, theme, onPress }: { icon: string; label: string; theme: any; onPress: () => void }) {
  return (
    <TouchableOpacity onPress={onPress} activeOpacity={0.7}>
      <Surface style={[styles.menuRow, { backgroundColor: theme.colors.surface, borderColor: theme.custom.cardBorder }]}>
        <MaterialCommunityIcons name={icon as any} size={22} color={theme.colors.primary} />
        <Text style={[styles.menuLabel, { color: theme.colors.onSurface }]}>{label}</Text>
        <MaterialCommunityIcons name="chevron-right" size={20} color={theme.colors.onSurface + '44'} />
      </Surface>
    </TouchableOpacity>
  );
}

function AchievementRow({ achievement, theme }: { achievement: any; theme: any }) {
  return (
    <Surface style={[styles.achievementRow, { backgroundColor: theme.colors.surface, borderColor: achievement.isUnlocked ? theme.custom.xp : theme.custom.cardBorder, opacity: achievement.isUnlocked ? 1 : 0.45 }]}>
      <Text style={{ fontSize: 20 }}>{achievement.isUnlocked ? '🏆' : '🔒'}</Text>
      <View style={styles.achievContent}>
        <Text style={[styles.achievName, { color: theme.colors.onSurface }]}>{achievement.name}</Text>
        <Text style={[styles.achievDesc, { color: theme.colors.onSurface + '77' }]}>{achievement.description}</Text>
      </View>
    </Surface>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  scroll: { padding: 16, gap: 6 },
  header: { paddingTop: 48, marginBottom: 8 },
  title: { fontSize: 28, fontWeight: '800' },
  section: { fontSize: 11, fontWeight: '700', letterSpacing: 1, marginTop: 12, marginBottom: 4 },
  menuRow: {
    borderRadius: 12,
    borderWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    gap: 12,
    elevation: 1,
    marginBottom: 4,
  },
  menuLabel: { flex: 1, fontSize: 15, fontWeight: '600' },
  themeGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  themeChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 10,
    minWidth: '45%',
  },
  themeDot: { width: 14, height: 14, borderRadius: 7 },
  themeLabel: { fontSize: 13, fontWeight: '600', flex: 1 },
  achievementRow: {
    borderRadius: 10,
    borderWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    gap: 12,
    marginBottom: 4,
    elevation: 1,
  },
  achievContent: { flex: 1 },
  achievName: { fontSize: 14, fontWeight: '700' },
  achievDesc: { fontSize: 12 },
});
