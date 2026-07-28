import { create } from 'zustand';
import type { ThemeKey } from '@/theme/themes';

interface SettingsState {
  theme: ThemeKey;
  userName: string;
  setTheme: (theme: ThemeKey) => void;
  setUserName: (name: string) => void;
}

export const useSettingsStore = create<SettingsState>((set) => ({
  theme: 'lightBrown',
  userName: 'Me',
  setTheme: (theme) => set({ theme }),
  setUserName: (userName) => set({ userName }),
}));
