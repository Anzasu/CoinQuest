import React, { useEffect, useState } from 'react';
import { Stack } from 'expo-router';
import { PaperProvider } from 'react-native-paper';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { StatusBar } from 'expo-status-bar';
import * as SQLite from 'expo-sqlite';
import { runMigrations } from '@/db/migrations';
import { useSettingsStore } from '@/stores/settingsStore';
import { useDbStore } from '@/stores/dbStore';
import { themes } from '@/theme/themes';
import { View, ActivityIndicator, StyleSheet } from 'react-native';
import { Text } from 'react-native-paper';

export default function RootLayout() {
  const themeKey = useSettingsStore((s) => s.theme);
  const { setTheme, setUserName } = useSettingsStore();
  const { isReady, setReady } = useDbStore();
  const [initError, setInitError] = useState<string | null>(null);

  const theme = themes[themeKey];

  useEffect(() => {
    async function init() {
      try {
        const db = SQLite.openDatabaseSync('coinquest.db');
        await runMigrations(db);

        // Load saved settings
        const result = await db.getAllAsync<{ theme: string; user_name: string }>(
          'SELECT theme, user_name FROM app_settings WHERE id = 1 LIMIT 1',
        );
        if (result[0]) {
          setTheme(result[0].theme as any);
          setUserName(result[0].user_name);
        }

        setReady(true);
      } catch (e: any) {
        setInitError(e.message ?? 'Failed to initialize database');
      }
    }
    init();
  }, []);

  if (initError) {
    return (
      <View style={[styles.center, { backgroundColor: '#0f0f1a' }]}>
        <Text style={{ color: '#ff5555', textAlign: 'center', padding: 24 }}>
          Failed to start: {initError}
        </Text>
      </View>
    );
  }

  if (!isReady) {
    return (
      <View style={[styles.center, { backgroundColor: theme.colors.background }]}>
        <ActivityIndicator size="large" color={theme.colors.primary} />
      </View>
    );
  }

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <PaperProvider theme={theme}>
        <StatusBar style={theme.dark ? 'light' : 'dark'} />
        <Stack screenOptions={{ headerShown: false }}>
          <Stack.Screen name="(tabs)" />
          <Stack.Screen name="month/new" options={{ presentation: 'modal' }} />
          <Stack.Screen name="month/[id]" />
          <Stack.Screen name="expenses/add" options={{ presentation: 'modal' }} />
          <Stack.Screen name="expenses/[id]/edit" options={{ presentation: 'modal' }} />
          <Stack.Screen name="piggy/new" options={{ presentation: 'modal' }} />
          <Stack.Screen name="piggy/[id]" />
          <Stack.Screen name="transfers/add" options={{ presentation: 'modal' }} />
          <Stack.Screen name="income/add" options={{ presentation: 'modal' }} />
          <Stack.Screen name="legacy/import" options={{ presentation: 'modal' }} />
        </Stack>
      </PaperProvider>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
});
