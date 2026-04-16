/**
 * SpinForge - Command palette (cmd+K / ctrl+K)
 *
 * Global keyboard-first search over:
 *
 *   • Every page in the admin UI (nav destinations)
 *   • Every known node (hostname)
 *   • Every known workload/site (domain)
 *   • Every action verb (Deploy, Add Partner, Rotate key, ...)
 *
 * Opens from anywhere with ⌘K / Ctrl-K. Closes on Esc or backdrop
 * click. Enter executes the selected item. ↑/↓ moves selection.
 *
 * Fuzzy match is intentionally tiny (substring on lowercased label +
 * description). No dependency on an ML library; the dataset is small
 * enough that substring is both fast and predictable.
 */

import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Search, Server, Package, Activity, Users, Briefcase, Mail,
  Shield, ShieldAlert, Settings, Home, Upload, FileCode, Rocket,
  ArrowRight, CornerDownLeft,
} from 'lucide-react';
import { api, PlatformNodeSnapshot, PlatformWorkload } from '../services/api';

type Icon = React.ComponentType<{ size?: number; className?: string }>;

interface PaletteItem {
  id: string;
  group: 'Navigate' | 'Nodes' | 'Workloads' | 'Actions';
  icon: Icon;
  label: string;
  description?: string;
  run: () => void;
}

const NAV_ITEMS: Array<{ path: string; label: string; icon: Icon; desc?: string }> = [
  { path: '/home', label: 'Cluster', icon: Home, desc: 'Operator home' },
  { path: '/platform/nodes', label: 'Nodes', icon: Server },
  { path: '/platform/workloads', label: 'Workloads', icon: Package },
  { path: '/platform/events', label: 'Events', icon: Activity },
  { path: '/applications', label: 'Applications', icon: Package },
  { path: '/deploy', label: 'Deploy', icon: Upload },
  { path: '/customers', label: 'Customers', icon: Users },
  { path: '/partners', label: 'Partners', icon: Briefcase },
  { path: '/templates', label: 'Templates', icon: FileCode },
  { path: '/certificates', label: 'Certificates', icon: Shield },
  { path: '/email-templates', label: 'Email Templates', icon: Mail },
  { path: '/activity', label: 'Admin Activity', icon: ShieldAlert },
  { path: '/admin-users', label: 'Admin Users', icon: Users },
  { path: '/settings', label: 'Settings', icon: Settings },
];

export default function CommandPalette() {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [nodes, setNodes] = useState<PlatformNodeSnapshot[]>([]);
  const [workloads, setWorkloads] = useState<PlatformWorkload[]>([]);
  const [highlight, setHighlight] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();

  // Open on ⌘K / Ctrl-K. Close on Esc.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setOpen((v) => !v);
        return;
      }
      if (e.key === 'Escape' && open) {
        e.preventDefault();
        setOpen(false);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open]);

  // Lazy-load dynamic data the first time the palette opens, and
  // refresh on each subsequent open so the list doesn't go stale.
  useEffect(() => {
    if (!open) return;
    setQuery('');
    setHighlight(0);
    Promise.all([
      api.platformNodes().catch(() => ({ nodes: [] as PlatformNodeSnapshot[] })),
      api.platformWorkloads().catch(() => ({ workloads: [] as PlatformWorkload[] })),
    ]).then(([n, w]) => {
      setNodes(n.nodes || []);
      setWorkloads(w.workloads || []);
    });
    setTimeout(() => inputRef.current?.focus(), 0);
  }, [open]);

  const items: PaletteItem[] = useMemo(() => {
    const out: PaletteItem[] = [];

    for (const n of NAV_ITEMS) {
      out.push({
        id: `nav:${n.path}`,
        group: 'Navigate',
        icon: n.icon,
        label: n.label,
        description: n.desc,
        run: () => navigate(n.path),
      });
    }

    for (const node of nodes) {
      out.push({
        id: `node:${node.hostname}`,
        group: 'Nodes',
        icon: Server,
        label: node.hostname,
        description: node.ip ? `${node.ip} · ${node.role || 'node'}` : node.role || '',
        run: () => navigate('/platform/nodes'),
      });
    }

    for (const w of workloads) {
      out.push({
        id: `workload:${w.domain}`,
        group: 'Workloads',
        icon: Package,
        label: w.domain,
        description: `${w.type} · ${w.customerId || '—'}`,
        run: () => navigate(`/applications/${encodeURIComponent(w.domain)}`),
      });
    }

    // Common actions
    out.push({
      id: 'action:deploy',
      group: 'Actions',
      icon: Upload,
      label: 'Deploy a site',
      description: 'Open the deploy form',
      run: () => navigate('/deploy'),
    });
    out.push({
      id: 'action:partners',
      group: 'Actions',
      icon: Briefcase,
      label: 'Add a partner',
      description: 'Open partners admin',
      run: () => navigate('/partners'),
    });
    out.push({
      id: 'action:cert',
      group: 'Actions',
      icon: Shield,
      label: 'Inspect certificates',
      description: 'Open certificate manager',
      run: () => navigate('/certificates'),
    });
    out.push({
      id: 'action:email',
      group: 'Actions',
      icon: Mail,
      label: 'Send a test email',
      description: 'Open email templates',
      run: () => navigate('/email-templates'),
    });

    return out;
  }, [nodes, workloads, navigate]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return items;
    return items.filter((it) => {
      const hay = (it.label + ' ' + (it.description || '')).toLowerCase();
      return hay.includes(q);
    });
  }, [items, query]);

  // Group results for display
  const grouped = useMemo(() => {
    const g: Record<string, PaletteItem[]> = {};
    for (const it of filtered) { (g[it.group] = g[it.group] || []).push(it); }
    return g;
  }, [filtered]);

  // Keep highlight in range
  useEffect(() => { if (highlight >= filtered.length) setHighlight(0); }, [highlight, filtered.length]);

  function onKey(e: React.KeyboardEvent) {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setHighlight((h) => Math.min(h + 1, filtered.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setHighlight((h) => Math.max(h - 1, 0));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      const it = filtered[highlight];
      if (it) { it.run(); setOpen(false); }
    }
  }

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        title="Command palette (⌘K)"
        className="fixed bottom-4 right-4 z-40 h-10 w-10 rounded-full bg-gray-900 text-white shadow-lg hover:shadow-xl flex items-center justify-center"
      >
        <Search size={16} />
      </button>
    );
  }

  return (
    <AnimatePresence>
      <motion.div
        className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[100] flex items-start justify-center pt-20 px-4"
        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        onClick={() => setOpen(false)}
      >
        <motion.div
          initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.95, opacity: 0 }}
          transition={{ duration: 0.15 }}
          className="w-full max-w-xl bg-white rounded-xl shadow-2xl overflow-hidden"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="flex items-center gap-2 border-b px-4 py-3">
            <Rocket size={16} className="text-indigo-500" />
            <Search size={16} className="text-gray-400" />
            <input
              ref={inputRef}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={onKey}
              placeholder="Type a page, node, site, or action…"
              className="flex-1 bg-transparent outline-none text-sm"
            />
            <kbd className="text-xs px-1.5 py-0.5 border rounded text-gray-400 bg-gray-50">esc</kbd>
          </div>

          <div ref={listRef} className="max-h-96 overflow-y-auto py-2">
            {filtered.length === 0 ? (
              <div className="px-4 py-8 text-center text-sm text-gray-400">
                No matches for "<b>{query}</b>"
              </div>
            ) : (
              Object.entries(grouped).map(([group, list]) => (
                <div key={group}>
                  <div className="px-3 py-1 text-[10px] uppercase tracking-wider font-semibold text-gray-400">
                    {group}
                  </div>
                  {list.map((it) => {
                    const flatIdx = filtered.indexOf(it);
                    const active = flatIdx === highlight;
                    const Icon = it.icon;
                    return (
                      <button
                        key={it.id}
                        onMouseEnter={() => setHighlight(flatIdx)}
                        onClick={() => { it.run(); setOpen(false); }}
                        className={`flex items-center w-full px-3 py-2 text-sm transition-colors ${
                          active ? 'bg-indigo-50 text-indigo-900' : 'text-gray-800 hover:bg-gray-50'
                        }`}
                      >
                        <span className={`mr-2 p-1 rounded ${active ? 'bg-white' : 'bg-gray-100'}`}>
                          <Icon size={14} />
                        </span>
                        <span className="flex-1 text-left">
                          <span className="font-medium">{it.label}</span>
                          {it.description && (
                            <span className="ml-2 text-xs text-gray-500">{it.description}</span>
                          )}
                        </span>
                        {active && <CornerDownLeft size={12} className="text-indigo-500" />}
                        {!active && <ArrowRight size={12} className="text-gray-300" />}
                      </button>
                    );
                  })}
                </div>
              ))
            )}
          </div>

          <div className="border-t px-4 py-2 text-[11px] text-gray-400 flex items-center justify-between">
            <span>{filtered.length} result{filtered.length === 1 ? '' : 's'}</span>
            <span>
              <kbd className="px-1.5 py-0.5 border rounded bg-gray-50">↑</kbd>
              <kbd className="ml-1 px-1.5 py-0.5 border rounded bg-gray-50">↓</kbd>
              <span className="mx-1">to navigate ·</span>
              <kbd className="px-1.5 py-0.5 border rounded bg-gray-50">↵</kbd>
              <span className="ml-1">to open</span>
            </span>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
