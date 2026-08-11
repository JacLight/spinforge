/**
 * SpinForge - Confirm dialog
 * Copyright (c) 2025 Jacob Ajiboye
 * Licensed under the MIT License
 *
 * Replacement for native window.confirm() across the admin UI. Browser
 * dialogs are unstyled, easy to click-through, and ugly on touch. This
 * component gives each callsite the same modal semantics but with:
 *
 *   - themed severity (default, warning, danger)
 *   - optional "type this word to proceed" guard for destructive actions
 *   - loading state on the confirm button while the action runs
 *   - async resolution (hook returns a promise)
 *
 * Imperative API via the useConfirm() hook — matches the ergonomics of
 * window.confirm(), no manual mount/state needed at callsites:
 *
 *   const confirm = useConfirm();
 *   if (await confirm({ title: "Delete?", description: "..." })) {
 *     await doDelete();
 *   }
 */

import { createContext, useCallback, useContext, useRef, useState, ReactNode } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { AlertTriangle, X, Info, Trash2 } from 'lucide-react';

export type ConfirmSeverity = 'default' | 'warning' | 'danger';

export interface ConfirmOptions {
  title: string;
  description?: string;
  /** Label for the confirm button. Defaults to "Confirm". */
  confirmLabel?: string;
  /** Label for the cancel button. Defaults to "Cancel". */
  cancelLabel?: string;
  /** Visual treatment. Danger gets red, warning gets amber, default gets blue. */
  severity?: ConfirmSeverity;
  /**
   * If set, the user must type this string (case-sensitive) to enable
   * the confirm button. Use for irreversible actions like deleting a
   * partner or rotating a key.
   */
  typeToConfirm?: string;
}

type Resolver = (ok: boolean) => void;

const ConfirmCtx = createContext<((opts: ConfirmOptions) => Promise<boolean>) | null>(null);

export function useConfirm() {
  const ctx = useContext(ConfirmCtx);
  if (!ctx) throw new Error('useConfirm must be used inside <ConfirmProvider>');
  return ctx;
}

export function ConfirmProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<ConfirmOptions | null>(null);
  const [typed, setTyped] = useState('');
  const resolverRef = useRef<Resolver | null>(null);

  const confirm = useCallback((opts: ConfirmOptions) => {
    setTyped('');
    setState(opts);
    return new Promise<boolean>((resolve) => {
      resolverRef.current = resolve;
    });
  }, []);

  const close = (ok: boolean) => {
    const r = resolverRef.current;
    resolverRef.current = null;
    setState(null);
    setTyped('');
    r?.(ok);
  };

  const sev = state?.severity || 'default';
  const border =
    sev === 'danger'  ? 'border-red-500' :
    sev === 'warning' ? 'border-orange-500' :
                        'border-blue-500';
  const btn =
    sev === 'danger'  ? 'bg-red-600' :
    sev === 'warning' ? 'bg-orange-600' :
                        'bg-blue-600';
  const Icon =
    sev === 'danger'  ? Trash2 :
    sev === 'warning' ? AlertTriangle :
                        Info;
  const iconColor =
    sev === 'danger'  ? 'text-red-500' :
    sev === 'warning' ? 'text-orange-500' :
                        'text-blue-500';

  const typeOk = !state?.typeToConfirm || typed === state.typeToConfirm;

  return (
    <ConfirmCtx.Provider value={confirm}>
      {children}
      <AnimatePresence>
        {state && (
          <motion.div
            className="fixed inset-0 bg-black/50 flex items-center justify-center z-[60]"
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            onClick={() => close(false)}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
              className={`bg-white rounded-lg shadow-xl w-full max-w-lg p-6 border-t-4 ${border}`}
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-start gap-3">
                  <Icon size={22} className={`${iconColor} flex-shrink-0 mt-0.5`} />
                  <div>
                    <h2 className="text-lg font-semibold">{state.title}</h2>
                    {state.description && (
                      <p className="text-sm text-gray-600 mt-1">{state.description}</p>
                    )}
                  </div>
                </div>
                <button onClick={() => close(false)} className="text-gray-400 hover:text-gray-600">
                  <X size={18} />
                </button>
              </div>

              {state.typeToConfirm && (
                <label className="block text-sm mt-4">
                  <div className="text-gray-600 mb-1">
                    Type <b>{state.typeToConfirm}</b> to confirm:
                  </div>
                  <input
                    className="w-full border rounded px-3 py-2"
                    value={typed}
                    onChange={(e) => setTyped(e.target.value)}
                    autoFocus
                  />
                </label>
              )}

              <div className="flex justify-end gap-2 mt-5">
                <button
                  onClick={() => close(false)}
                  className="px-4 py-2 text-sm text-gray-600 hover:text-gray-900"
                >
                  {state.cancelLabel || 'Cancel'}
                </button>
                <button
                  onClick={() => close(true)}
                  disabled={!typeOk}
                  className={`px-4 py-2 text-sm text-white rounded ${btn} disabled:opacity-50`}
                >
                  {state.confirmLabel || 'Confirm'}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </ConfirmCtx.Provider>
  );
}
