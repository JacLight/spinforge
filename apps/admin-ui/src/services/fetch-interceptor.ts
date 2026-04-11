/**
 * SpinForge - Global fetch interceptor
 * Copyright (c) 2025 Jacob Ajiboye
 *
 * This software is licensed under the MIT License.
 * See the LICENSE file in the root directory for details.
 *
 * Monkey-patches window.fetch so every request made anywhere in the
 * admin-ui — raw fetch(), axios, api-client, tanstack-query, whatever —
 * automatically gets the right auth header attached.
 *
 * This exists because the admin-ui has ~60 raw fetch() call sites across
 * pages and components that bypass the axios interceptor. Rather than
 * migrating all of them one-by-one, we wrap the browser's fetch primitive
 * itself and every caller gets auth for free.
 *
 * Rules:
 *   - Admin-gated URLs (/api/*, /_admin/*)  → Authorization: Bearer <jwt>
 *     from localStorage.adminToken (set by the login flow)
 *   - Customer-gated URLs (/_api/customer/*) → left alone; those endpoints
 *     use a separate auth flow and the calling code is expected to attach
 *     its own headers
 *   - Everything else is passed through unchanged
 *
 * Must be imported at the VERY TOP of main.tsx, before any component or
 * service that might issue a fetch during import.
 */

// Grab the native fetch once. We install our wrapper by reassigning
// window.fetch below, so any subsequent access gets the wrapped version.
const nativeFetch = window.fetch.bind(window);

// True when the URL targets an admin-gated endpoint on our API. Matches:
//   /_admin/*          (mounted at server-openresty.js:48)
//   /api/*             (gated by authenticateAdminOrPublic in admin-auth.js)
//   https://host/api/* (when the admin-ui calls an absolute URL at api.spinforge.dev)
// Excludes /_api/customer/* which has its own (customer) auth.
function isAdminUrl(url: string | URL): boolean {
  const s = typeof url === 'string' ? url : url.toString();
  if (!s) return false;
  if (s.includes('/_admin/')) return true;
  if (s.includes('/_api/customer/')) return false;
  // Match /api/ as a path segment, both relative (/api/sites) and
  // absolute (https://api.spinforge.dev/api/sites).
  return /(^|\/)api\//.test(s);
}

// Public paths inside /api/* that MUST remain reachable without auth.
// Keep this list in lock-step with utils/admin-auth.js PUBLIC_API_PATHS.
const PUBLIC_API_PATHS = ['/api/health', '/api/_health'];

function isPublicApiUrl(url: string | URL): boolean {
  const s = typeof url === 'string' ? url : url.toString();
  try {
    // Extract the path portion so we only compare the route, not the host.
    const path = s.startsWith('http') ? new URL(s).pathname : s.split('?')[0];
    return PUBLIC_API_PATHS.some(
      (p) => path === p || path.startsWith(p + '/')
    );
  } catch {
    return false;
  }
}

/**
 * The wrapped fetch. Signature is identical to window.fetch so it's a
 * drop-in replacement and TypeScript is happy.
 */
const patchedFetch: typeof window.fetch = async (
  input: RequestInfo | URL,
  init: RequestInit = {}
): Promise<Response> => {
  // Normalise the URL we're about to hit for our rules.
  const url =
    typeof input === 'string'
      ? input
      : input instanceof URL
      ? input.toString()
      : input.url;

  // Short-circuit: not one of our admin-gated routes → passthrough.
  if (!isAdminUrl(url) || isPublicApiUrl(url)) {
    return nativeFetch(input as any, init);
  }

  // Merge our auth header into whatever the caller already set. Preserve
  // any headers they explicitly passed (they win on conflict).
  const existingHeaders = new Headers(init.headers || {});
  const sessionToken = localStorage.getItem('adminToken');

  // Only set if the caller hasn't already provided one and we have a token
  // to offer. A request made before login is intentionally sent without
  // headers so the server returns 401 and the 401 handler below redirects.
  if (sessionToken && !existingHeaders.has('Authorization')) {
    existingHeaders.set('Authorization', `Bearer ${sessionToken}`);
  }

  const mergedInit: RequestInit = { ...init, headers: existingHeaders };

  let response: Response;
  try {
    response = await nativeFetch(input as any, mergedInit);
  } catch (err) {
    throw err;
  }

  // On 401 from an admin endpoint, drop the session and force re-login.
  // Same behaviour as the axios response interceptor in axios-config.ts.
  if (response.status === 401) {
    // Avoid redirect loops — don't redirect if we're already at the
    // login screen, and don't redirect on anonymous boot fetches that
    // happen before the user ever had a token.
    if (sessionToken) {
      localStorage.removeItem('adminToken');
      if (!window.location.pathname.includes('/login')) {
        window.location.href = '/';
      }
    }
  }

  return response;
};

/**
 * Install the interceptor. Safe to call multiple times — subsequent calls
 * are no-ops thanks to the __spinforgePatched__ marker.
 */
export function installFetchInterceptor(): void {
  const anyWindow = window as any;
  if (anyWindow.__spinforgePatched__) return;
  anyWindow.__spinforgePatched__ = true;
  window.fetch = patchedFetch;
  // eslint-disable-next-line no-console
  console.log('[fetch-interceptor] installed');
}
