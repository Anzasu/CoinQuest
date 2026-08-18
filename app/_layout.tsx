import React, { useEffect, useState } from 'react';
import { Stack } from 'expo-router';
import { PaperProvider, Text } from 'react-native-paper';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { StatusBar } from 'expo-status-bar';
import * as Font from 'expo-font';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import {
  View,
  ActivityIndicator,
  StyleSheet,
} from 'react-native';

import { sqliteDb } from '@/db';
import { runMigrations } from '@/db/migrations';
import { useSettingsStore } from '@/stores/settingsStore';
import { useDbStore } from '@/stores/dbStore';
import { themes } from '@/theme/themes';

export default function RootLayout() {
  const themeKey = useSettingsStore((state) => state.theme);
  const setTheme = useSettingsStore((state) => state.setTheme);
  const setUserName = useSettingsStore((state) => state.setUserName);

  const isReady = useDbStore((state) => state.isReady);
  const setReady = useDbStore((state) => state.setReady);

  const [initError, setInitError] = useState<string | null>(null);
  const [fontsLoaded, setFontsLoaded] = useState(false);
  const [fontError, setFontError] = useState<string | null>(null);

  const theme = themes[themeKey];

  useEffect(() => {
    let isMounted = true;

    async function loadIconFont() {
      try {
        console.log('[CoinQuest] Loading MaterialCommunityIcons font');

        await Font.loadAsync({
          ...MaterialCommunityIcons.font,
        });

        if (isMounted) {
          console.log('[CoinQuest] MaterialCommunityIcons font loaded');
          setFontsLoaded(true);
        }
      } catch (error: any) {
        console.error(
          '[CoinQuest] MaterialCommunityIcons font failed:',
          error,
        );

        if (isMounted) {
          setFontError(
            error?.message ??
              'Failed to load Material Community Icons font',
          );
        }
      }
    }

    loadIconFont();

    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    let isMounted = true;

    async function initializeDatabase() {
      try {
        console.log('[CoinQuest] Starting migrations');

        await runMigrations(sqliteDb);

        console.log('[CoinQuest] Migrations completed');

        const result = await sqliteDb.getAllAsync<{
          theme: string;
          user_name: string;
        }>(
          'SELECT theme, user_name FROM app_settings WHERE id = 1 LIMIT 1',
        );

        console.log('[CoinQuest] Settings query completed');

        if (result[0]) {
          setTheme(result[0].theme as any);
          setUserName(result[0].user_name);
        }

        if (isMounted) {
          setReady(true);
          console.log('[CoinQuest] App is ready');
        }
      } catch (error: any) {
        console.error(
          '[CoinQuest] Database initialization failed:',
          error,
        );

        if (isMounted) {
          setInitError(
            error?.message ??
              'Failed to initialize the database',
          );
        }
      }
    }

    initializeDatabase();

    return () => {
      isMounted = false;
    };
  }, [setReady, setTheme, setUserName]);

  if (initError) {
    return (
      <View style={[styles.center, styles.errorContainer]}>
        <Text style={styles.errorText}>
          Database initialization failed:
          {'\n\n'}
          {initError}
        </Text>
      </View>
    );
  }

  if (fontError) {
    return (
      <View style={[styles.center, styles.errorContainer]}>
        <Text style={styles.errorText}>
          Icon font loading failed:
          {'\n\n'}
          {fontError}
        </Text>
      </View>
    );
  }

  if (!isReady || !fontsLoaded) {
    return (
      <View
        style={[
          styles.center,
          { backgroundColor: theme.colors.background },
        ]}
      >
        <ActivityIndicator
          size="large"
          color={theme.colors.primary}
        />

        <Text
          style={[
            styles.loadingText,
            { color: theme.colors.onBackground },
          ]}
        >
          Database ready: {String(isReady)}
          {'\n'}
          Fonts loaded: {String(fontsLoaded)}
        </Text>
      </View>
    );
  }

  return (
    <GestureHandlerRootView style={styles.root}>
      <PaperProvider theme={theme}>
        <StatusBar
          style={theme.dark ? 'light' : 'dark'}
        />

        <Stack screenOptions={{ headerShown: false }}>
          <Stack.Screen name="(tabs)" />

          <Stack.Screen
            name="month/new"
            options={{ presentation: 'modal' }}
          />

          <Stack.Screen name="month/[id]" />

          <Stack.Screen
            name="expenses/add"
            options={{ presentation: 'modal' }}
          />

          <Stack.Screen
            name="expenses/[id]/edit"
            options={{ presentation: 'modal' }}
          />

          <Stack.Screen
            name="piggy/new"
            options={{ presentation: 'modal' }}
          />

          <Stack.Screen name="piggy/[id]" />

          <Stack.Screen
            name="transfers/add"
            options={{ presentation: 'modal' }}
          />

          <Stack.Screen
            name="income/add"
            options={{ presentation: 'modal' }}
          />

          <Stack.Screen
            name="legacy/import"
            options={{ presentation: 'modal' }}
          />
        </Stack>
      </PaperProvider>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },

  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },

  loadingText: {
    marginTop: 16,
    textAlign: 'center',
  },

  errorContainer: {
    backgroundColor: '#0f0f1a',
  },

  errorText: {
    color: '#ff5555',
    textAlign: 'center',
  },
});