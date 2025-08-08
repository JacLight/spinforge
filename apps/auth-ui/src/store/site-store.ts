import { activeSession } from '@/request/appengine';
import { create } from 'zustand';

interface Notice {
  message: string;
  type: 'success' | 'error' | 'info';
  id: string;
}

interface SiteState {
  isLoading: boolean;
  notices: Notice[];
  isAuthenticated: boolean;
  user?: any;
  userOrgs?: any[];
  
  // Actions
  setStateItem: (items: Partial<SiteState>) => void;
  showNotice: (message: string, type: 'success' | 'error' | 'info') => void;
  removeNotice: (id: string) => void;
  login: (session: any) => Promise<void>;
}

export const useSiteStore = create<SiteState>((set) => ({
  isLoading: false,
  notices: [],
  isAuthenticated: false,
  user: undefined,
  userOrgs: undefined,
  
  setStateItem: (items) => set((state) => ({ ...state, ...items })),
  
  showNotice: (message, type) => {
    const id = `${Date.now()}-${Math.random()}`;
    const notice: Notice = { message, type, id };
    
    set((state) => ({
      notices: [...state.notices, notice],
    }));
    
    // Auto-remove notice after 5 seconds
    setTimeout(() => {
      set((state) => ({
        notices: state.notices.filter((n) => n.id !== id),
      }));
    }, 5000);
  },
  
  removeNotice: (id) => {
    set((state) => ({
      notices: state.notices.filter((n) => n.id !== id),
    }));
  },
  
  login: async (session) => {
    set((state) => ({
      ...state,
      isAuthenticated: true,
      user: session.user,
    }));
  },
}));
