import { create } from 'zustand';
import { getRandomString } from '../utils/helpers';


export interface SiteStoreProps {
  
  showNotice?: (message, type: string) => void;
  showConfirm?: (message, buttons, callback) => void;
}

export const useSiteStore = create<SiteStoreProps>()((set, get) => ({
  siteTreeVisible: true,
  statusView: 'web',
  showNotice: (message, type: string) => {
    if (typeof message !== 'string') return;
    const notification = { id: getRandomString(6), title: '', message, type, status: 'new' };
    set({ notifications: [...(get().notifications || []), notification] });
  },
  showConfirm: (message, buttons, callback) => {
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
  setStateItem: (items: { [key: string]: any }) => set((state: any) => ({ ...items })),
  getStateItem: (key: string) => get()[key],
  
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
