import { create } from 'zustand';

interface DbState {
  isReady: boolean;
  setReady: (ready: boolean) => void;
}

export const useDbStore = create<DbState>((set) => ({
  isReady: false,
  setReady: (isReady) => set({ isReady }),
}));
