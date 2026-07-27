import { MD3LightTheme, MD3DarkTheme, MD3Theme } from 'react-native-paper';

export type ThemeKey = 'dark' | 'light' | 'babyPink' | 'lightBrown' | 'lightBlue' | 'forestGreen';

export const THEME_LABELS: Record<ThemeKey, string> = {
  dark: 'Dark',
  light: 'Light',
  babyPink: 'Baby Pink',
  lightBrown: 'Sand',
  lightBlue: 'Sky Blue',
  forestGreen: 'Forest',
};

// Extend Paper theme with our custom color tokens
export interface AppColors {
  partA: string;
  partB: string;
  partC: string;
  partD: string;
  income: string;
  expense: string;
  transfer: string;
  xp: string;
  cardBorder: string;
  tabBar: string;
  tabBarActive: string;
  tabBarInactive: string;
}

export interface AppTheme extends MD3Theme {
  custom: AppColors;
}

function makeTheme(base: MD3Theme, overrides: Partial<MD3Theme['colors']>, custom: AppColors): AppTheme {
  return {
    ...base,
    colors: { ...base.colors, ...overrides },
    custom,
  } as AppTheme;
}

export const themes: Record<ThemeKey, AppTheme> = {
  dark: makeTheme(
    MD3DarkTheme,
    {
      primary: '#e94560',
      primaryContainer: '#3d0015',
      secondary: '#f5a623',
      background: '#0f0f1a',
      surface: '#1a1a2e',
      surfaceVariant: '#16213e',
      onBackground: '#eaeaea',
      onSurface: '#eaeaea',
      outline: '#333355',
      error: '#ff5555',
    },
    {
      partA: '#7b61ff',
      partB: '#00bcd4',
      partC: '#4caf50',
      partD: '#f5a623',
      income: '#4caf50',
      expense: '#e94560',
      transfer: '#7b61ff',
      xp: '#f5a623',
      cardBorder: '#333355',
      tabBar: '#1a1a2e',
      tabBarActive: '#e94560',
      tabBarInactive: '#666688',
    },
  ),

  light: makeTheme(
    MD3LightTheme,
    {
      primary: '#2563eb',
      primaryContainer: '#dbeafe',
      secondary: '#f59e0b',
      background: '#f8f9fa',
      surface: '#ffffff',
      surfaceVariant: '#f1f5f9',
      onBackground: '#111827',
      onSurface: '#111827',
      outline: '#e2e8f0',
      error: '#dc2626',
    },
    {
      partA: '#7c3aed',
      partB: '#0891b2',
      partC: '#059669',
      partD: '#d97706',
      income: '#059669',
      expense: '#dc2626',
      transfer: '#7c3aed',
      xp: '#d97706',
      cardBorder: '#e2e8f0',
      tabBar: '#ffffff',
      tabBarActive: '#2563eb',
      tabBarInactive: '#94a3b8',
    },
  ),

  babyPink: makeTheme(
    MD3LightTheme,
    {
      primary: '#d63384',
      primaryContainer: '#ffe4ef',
      secondary: '#c77dff',
      background: '#fff0f6',
      surface: '#ffffff',
      surfaceVariant: '#fce4ec',
      onBackground: '#4a0020',
      onSurface: '#4a0020',
      outline: '#f8bbd0',
      error: '#c62828',
    },
    {
      partA: '#c77dff',
      partB: '#7b61ff',
      partC: '#4caf50',
      partD: '#ff8fab',
      income: '#4caf50',
      expense: '#d63384',
      transfer: '#c77dff',
      xp: '#ff8fab',
      cardBorder: '#f8bbd0',
      tabBar: '#ffe4ef',
      tabBarActive: '#d63384',
      tabBarInactive: '#f48fb1',
    },
  ),

  lightBrown: makeTheme(
    MD3LightTheme,
    {
      primary: '#7c5c3d',
      primaryContainer: '#f5ebe0',
      secondary: '#a0785a',
      background: '#fdf6ee',
      surface: '#ffffff',
      surfaceVariant: '#f5ebe0',
      onBackground: '#3d1c02',
      onSurface: '#3d1c02',
      outline: '#e0cbb3',
      error: '#b71c1c',
    },
    {
      partA: '#a0785a',
      partB: '#5d8a6e',
      partC: '#4a7c59',
      partD: '#c8a97e',
      income: '#4a7c59',
      expense: '#7c5c3d',
      transfer: '#a0785a',
      xp: '#c8a97e',
      cardBorder: '#e0cbb3',
      tabBar: '#f5ebe0',
      tabBarActive: '#7c5c3d',
      tabBarInactive: '#bda98a',
    },
  ),

  lightBlue: makeTheme(
    MD3LightTheme,
    {
      primary: '#0369a1',
      primaryContainer: '#e0f2fe',
      secondary: '#0ea5e9',
      background: '#f0f9ff',
      surface: '#ffffff',
      surfaceVariant: '#e0f2fe',
      onBackground: '#0c4a6e',
      onSurface: '#0c4a6e',
      outline: '#bae6fd',
      error: '#b91c1c',
    },
    {
      partA: '#6366f1',
      partB: '#0ea5e9',
      partC: '#059669',
      partD: '#f59e0b',
      income: '#059669',
      expense: '#0369a1',
      transfer: '#6366f1',
      xp: '#f59e0b',
      cardBorder: '#bae6fd',
      tabBar: '#e0f2fe',
      tabBarActive: '#0369a1',
      tabBarInactive: '#7dd3fc',
    },
  ),

  forestGreen: makeTheme(
    MD3LightTheme,
    {
      primary: '#2d6a4f',
      primaryContainer: '#d8f3dc',
      secondary: '#52b788',
      background: '#f1f8f4',
      surface: '#ffffff',
      surfaceVariant: '#d8f3dc',
      onBackground: '#1b4332',
      onSurface: '#1b4332',
      outline: '#b7e4c7',
      error: '#b91c1c',
    },
    {
      partA: '#52b788',
      partB: '#1a759f',
      partC: '#2d6a4f',
      partD: '#d4a017',
      income: '#2d6a4f',
      expense: '#b91c1c',
      transfer: '#52b788',
      xp: '#d4a017',
      cardBorder: '#b7e4c7',
      tabBar: '#d8f3dc',
      tabBarActive: '#2d6a4f',
      tabBarInactive: '#74c69d',
    },
  ),
};
