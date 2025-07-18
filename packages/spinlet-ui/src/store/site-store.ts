import { create } from 'zustand';
import { getRandomString } from '../utils';

interface Notification {
  id: string;
  title: string;
  message: string;
  type: string;
  status: string;
}

interface ConfirmDialog {
  message: string;
  buttons: string[];
  callback: () => void;
}

interface MinimizedWindow {
  id: string;
  title: string;
  content: any;
  onRestore: () => void;
  onClose: () => void;
}

export interface SiteStoreProps {
  // UI State
  siteTreeVisible: boolean;
  statusView: string;
  isDockedOpen?: boolean;
  statusHeight: number;
  
  // Notifications
  notifications: Notification[];
  showNotice: (message: string, type: string) => void;
  
  // Dialogs
  confirmDialog: ConfirmDialog | null;
  showConfirm: (message: string, buttons: string[], callback: () => void) => void;
  
  // Window Management
  minimizedWindows: MinimizedWindow[];
  dockedWindows: MinimizedWindow[];
  
  // Generic state management
  setStateItem: (items: { [key: string]: any }) => void;
  getStateItem: (key: string) => any;
}

export const useSiteStore = create<SiteStoreProps>()((set, get) => ({
  // Initial state
  siteTreeVisible: true,
  statusView: 'web',
  statusHeight: 0,
  notifications: [],
  confirmDialog: null,
  minimizedWindows: [],
  dockedWindows: [],
  
  // Actions
  showNotice: (message: string, type: string) => {
    if (typeof message !== 'string') return;
    const notification = { id: getRandomString(6), title: '', message, type, status: 'new' };
    set({ notifications: [...get().notifications, notification] });
  },
  
  showConfirm: (message: string, buttons: string[], callback: () => void) => {
    if (typeof message !== 'string') return;
    const confirm = {
      message,
      buttons,
      callback: () => {
        callback();
        set({ confirmDialog: null });
      },
    };
    set({ confirmDialog: confirm });
  },
  
  setStateItem: (items: { [key: string]: any }) => set((state) => ({ ...state, ...items })),
  getStateItem: (key: string) => get()[key as keyof SiteStoreProps],
}));

export enum NotificationType {
  Success = 'success',
  Warning = 'warning',
  Info = 'info',
  Error = 'error',
}

export const showNotice = (message: string, type: NotificationType | string = NotificationType.Info) => {
  if (typeof message !== 'string') return;
  useSiteStore.getState().showNotice(message, type);
};

export const showConfirm = (message: string, buttons: string[], callback: () => void, className?: string, title?: string) => {};
