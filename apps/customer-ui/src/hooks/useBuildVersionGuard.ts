/**
 * Reload the app when a new build is deployed.
 *
 * index.html names a fingerprinted bundle. A browser holding a stale copy
 * of index.html keeps loading the previous deploy's JavaScript, so shipped
 * fixes simply don't reach the user — and the only escape was telling them
 * to hard-refresh, which is not something real users will ever do.
 *
 * This polls index.html with `cache: 'no-store'`, compares the bundle it
 * names against the one this page actually loaded, and reloads once when
 * they diverge. Nothing is added to the build: the fingerprint Vite
 * already generates is the version.
 */

import { useEffect } from 'react';

const CHECK_INTERVAL_MS = 60_000;
// Guards against a reload loop if the served HTML and the loaded bundle
// can never agree (a half-rolled deploy, a proxy pinning an old copy).
const RELOAD_GUARD_KEY = 'spinforge:reloaded-for-build';
const RELOAD_GUARD_MS = 30_000;

/** The main bundle this page is actually running. */
function currentBundle(): string | null {
  const scripts = Array.from(document.querySelectorAll('script[src]')) as HTMLScriptElement[];
  const match = scripts
    .map((s) => s.getAttribute('src') || '')
    .find((src) => /\/assets\/index-[^/]+\.js$/.test(src));
  return match ? match.split('/').pop()! : null;
}

async function servedBundle(): Promise<string | null> {
  const res = await fetch(`/index.html?_=${Date.now()}`, {
    cache: 'no-store',
    credentials: 'same-origin',
  });
  if (!res.ok) return null;
  const html = await res.text();
  const m = html.match(/\/assets\/(index-[^"']+\.js)/);
  return m ? m[1] : null;
}

function recentlyReloaded(): boolean {
  try {
    const at = Number(sessionStorage.getItem(RELOAD_GUARD_KEY) || 0);
    return at > 0 && Date.now() - at < RELOAD_GUARD_MS;
  } catch {
    return false;
  }
}

export function useBuildVersionGuard() {
  useEffect(() => {
    let stopped = false;
    const mine = currentBundle();
    // Dev server has no fingerprinted bundle — nothing to compare.
    if (!mine) return;

    async function check() {
      if (stopped || document.hidden || recentlyReloaded()) return;
      try {
        const served = await servedBundle();
        if (!served || served === mine) return;
        try { sessionStorage.setItem(RELOAD_GUARD_KEY, String(Date.now())); } catch { /* private mode */ }
        window.location.reload();
      } catch {
        // Offline or a blip — the next tick tries again.
      }
    }

    check();
    const timer = setInterval(check, CHECK_INTERVAL_MS);
    // Coming back to the tab is the moment a user is most likely to act on
    // stale code, so re-check then too.
    const onFocus = () => { check(); };
    window.addEventListener('focus', onFocus);

    return () => {
      stopped = true;
      clearInterval(timer);
      window.removeEventListener('focus', onFocus);
    };
  }, []);
}

export default useBuildVersionGuard;
