import { useSettingsStore } from '@/stores/settingsStore';
import { themes, type AppTheme } from '@/theme/themes';

export function useAppTheme(): AppTheme {
  const themeKey = useSettingsStore((s) => s.theme);
  return themes[themeKey];
}
