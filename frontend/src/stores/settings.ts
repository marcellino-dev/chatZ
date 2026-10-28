import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export type Theme = 'light' | 'dark';
export type MessageSound = 'ding' | 'notification' | 'none';

interface SettingsState {
  notificationsEnabled: boolean;
  messageNotifications: boolean;
  ticketNotifications: boolean;
  soundEnabled: boolean;
  soundType: MessageSound;
  showPreview: boolean;
  theme: Theme;
  density: 'compact' | 'comfortable';
  hidePhone: boolean;
  hideEmail: boolean;

  // 🔥 NOVO: rastrear se já pediu permissão
  hasRequestedPermission: boolean;

  setNotificationsEnabled: (v: boolean) => void;
  setMessageNotifications: (v: boolean) => void;
  setTicketNotifications: (v: boolean) => void;
  setSoundEnabled: (v: boolean) => void;
  setSoundType: (v: MessageSound) => void;
  setShowPreview: (v: boolean) => void;
  setTheme: (v: Theme) => void;
  setDensity: (v: 'compact' | 'comfortable') => void;
  setHidePhone: (v: boolean) => void;
  setHideEmail: (v: boolean) => void;
  setHasRequestedPermission: (v: boolean) => void;
  reset: () => void;
}

const DEFAULTS = {
  notificationsEnabled: true,
  messageNotifications: true,
  ticketNotifications: true,
  soundEnabled: true,
  soundType: 'ding' as MessageSound,
  showPreview: true,
  theme: 'light' as Theme,
  density: 'comfortable' as const,
  hidePhone: false,
  hideEmail: false,
  hasRequestedPermission: false,
};

export const useSettingsStore = create<SettingsState>()(
  persist(
    (set) => ({
      ...DEFAULTS,
      setNotificationsEnabled: (v) => set({ notificationsEnabled: v }),
      setMessageNotifications: (v) => set({ messageNotifications: v }),
      setTicketNotifications: (v) => set({ ticketNotifications: v }),
      setSoundEnabled: (v) => set({ soundEnabled: v }),
      setSoundType: (v) => set({ soundType: v }),
      setShowPreview: (v) => set({ showPreview: v }),
      setTheme: (v) => set({ theme: v }),
      setDensity: (v) => set({ density: v }),
      setHidePhone: (v) => set({ hidePhone: v }),
      setHideEmail: (v) => set({ hideEmail: v }),
      setHasRequestedPermission: (v) => set({ hasRequestedPermission: v }),
      reset: () => set(DEFAULTS),
    }),
    { name: 'chatz-settings' }
  )
);