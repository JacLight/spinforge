import axios from 'axios';

export interface CustomerSession {
  token: string;
  refreshToken?: string;
  apiToken?: string;
  /** Present on magic-link sign-in: false means the account has no password yet. */
  hasPassword?: boolean;
  user: {
    email: string;
    name?: string;
    customerId: string;
    role?: string;
  };
}

function toSession(data: any): CustomerSession {
  if (!data?.success || !data?.token || !data?.user) {
    throw new Error(data?.message || data?.error || 'Sign-in failed');
  }
  return {
    token: data.token,
    refreshToken: data.refreshToken,
    apiToken: data.apiToken,
    hasPassword: data.hasPassword,
    user: data.user,
  };
}

export const customerAuth = {
  login: async (email: string, password: string): Promise<CustomerSession> => {
    const { data } = await axios.post('/_auth/customer/login', { email, password });
    return toSession(data);
  },

  /** Ask for a sign-in link. Always resolves — the API never reveals whether the address exists. */
  requestMagicLink: async (email: string): Promise<string> => {
    const { data } = await axios.post('/_auth/customer/magic-link', { email });
    return data?.message || 'If that email has a SpinForge account, a sign-in link is on its way.';
  },

  consumeMagicLink: async (token: string): Promise<CustomerSession> => {
    const { data } = await axios.post('/_auth/customer/magic-link/consume', { token });
    return toSession(data);
  },

  requestPasswordReset: async (email: string): Promise<string> => {
    const { data } = await axios.post('/_auth/customer/forgot-password', { email });
    return data?.message || 'If that email has a SpinForge account, a reset link is on its way.';
  },

  resetPassword: async (token: string, password: string): Promise<CustomerSession> => {
    const { data } = await axios.post('/_auth/customer/reset-password', { token, password });
    return toSession(data);
  },

  changePassword: async (
    token: string,
    currentPassword: string | undefined,
    newPassword: string,
  ): Promise<CustomerSession> => {
    const { data } = await axios.post(
      '/_auth/customer/change-password',
      { currentPassword, newPassword },
      { headers: { Authorization: `Bearer ${token}` } },
    );
    return toSession(data);
  },

  verify: async (token: string): Promise<boolean> => {
    try {
      const { data } = await axios.post('/_auth/customer/verify', { token });
      return Boolean(data?.valid ?? data?.success);
    } catch {
      return false;
    }
  },

  logout: async (token: string): Promise<void> => {
    try {
      await axios.post('/_auth/customer/logout', { token });
    } catch {
      // best-effort
    }
  },
};

export const CUSTOMER_AUTH_KEYS = {
  authToken: 'authToken',
  customerId: 'customerId',
  email: 'customerEmail',
  role: 'customerRole',
} as const;

export function persistSession(s: CustomerSession) {
  localStorage.setItem(CUSTOMER_AUTH_KEYS.authToken, s.token);
  localStorage.setItem(CUSTOMER_AUTH_KEYS.customerId, s.user.customerId);
  localStorage.setItem(CUSTOMER_AUTH_KEYS.email, s.user.email);
  if (s.user.role) localStorage.setItem(CUSTOMER_AUTH_KEYS.role, s.user.role);
}

export function clearSession() {
  Object.values(CUSTOMER_AUTH_KEYS).forEach((k) => localStorage.removeItem(k));
}

export function getCurrentSession(): { authToken: string | null; customerId: string | null; email: string | null } {
  return {
    authToken: localStorage.getItem(CUSTOMER_AUTH_KEYS.authToken),
    customerId: localStorage.getItem(CUSTOMER_AUTH_KEYS.customerId),
    email: localStorage.getItem(CUSTOMER_AUTH_KEYS.email),
  };
}

/**
 * Read `?mode=magic|reset|forgot&token=…` from the URL emailed links land on,
 * then strip it from history so a shoulder-surfer or a shared screenshot
 * can't replay the token.
 */
export function readAuthLinkFromUrl(): { mode: 'magic' | 'reset' | 'forgot'; token: string } | null {
  const params = new URLSearchParams(window.location.search);
  const mode = params.get('mode');
  const token = params.get('token') || '';

  if (mode !== 'magic' && mode !== 'reset' && mode !== 'forgot') return null;
  if (mode !== 'forgot' && !token) return null;

  window.history.replaceState({}, document.title, window.location.pathname);
  return { mode, token };
}
