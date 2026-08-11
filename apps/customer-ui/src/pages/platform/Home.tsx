/**
 * SpinForge - Platform → Home
 *
 * The default landing page after login. One screen that tells the
 * operator the state of the world:
 *
 *   • Incident banner      — anything that needs attention, right now
 *   • Summary row           — node count, workloads, events/day, load
 *   • Live nodes strip      — compact status of every node
 *   • Events feed           — last 20 events, live-updating
 *   • Quick action shortcuts — the things you do most often
 *
 * Backed entirely by the shared WebSocket + existing REST endpoints.
 * Never polls. If nothing's happening, nothing moves.
 */

import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Server, Package, Activity, AlertTriangle, AlertCircle,
  ArrowRight, Plus, Briefcase, Users, Shield, RefreshCw, Zap,
} from 'lucide-react';
import { api, PlatformWorkload } from '../../services/api';
import {
  usePlatformSocket, usePlatformSocketAutoConnect, PlatformNode, PlatformEvent,
} from '../../hooks/usePlatformSocket';

function secondsSince(iso?: string): number {
  if (!iso) return Infinity;
  return Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 1000));
}

function formatAgo(iso: string): string {
  const s = secondsSince(iso);
  if (s < 60) return `${s}s ago`;
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return `${Math.floor(s / 86400)}d ago`;
}

interface Incident {
  severity: 'warn' | 'error';
  title: string;
  detail: string;
  link?: string;
}

function deriveIncidents(nodes: PlatformNode[], events: PlatformEvent[]): Incident[] {
  const out: Incident[] = [];

  // Stale nodes: haven't heartbeated in > 90s
  const stale = nodes.filter((n) => secondsSince(n.updatedAt) > 90);
  for (const n of stale) {
    out.push({
      severity: 'error',
      title: `Node ${n.hostname} not responding`,
      detail: `Last seen ${formatAgo(n.updatedAt)}. Check the node or its api container.`,
      link: '/platform/nodes',
    });
  }

  // High memory usage
  for (const n of nodes) {
    const total = n.memBytes?.total || 0;
    const free  = n.memBytes?.free  || 0;
    if (!total) continue;
    const pct = (total - free) / total;
    if (pct > 0.9) {
      out.push({
        severity: 'warn',
        title: `${n.hostname} memory at ${Math.round(pct * 100)}%`,
        detail: 'Consider draining or adding capacity.',
        link: '/platform/nodes',
      });
    }
  }

  // Error-severity events in the last hour
  const hourAgo = Date.now() - 3600_000;
  const recentErrors = events.filter((e) =>
    e.severity === 'error' && new Date(e.ts).getTime() > hourAgo
  );
  if (recentErrors.length > 0) {
    out.push({
      severity: 'error',
      title: `${recentErrors.length} error event${recentErrors.length > 1 ? 's' : ''} in the last hour`,
      detail: recentErrors.slice(0, 3).map((e) => `${e.type} · ${e.subject}`).join(' · ') || '',
      link: '/platform/events',
    });
  }

  // Repeated admin.login.failed (>3 in last 15min) → brute force hint
  const loginFails = events.filter((e) =>
    e.type === 'admin.login.failed' && Date.now() - new Date(e.ts).getTime() < 15 * 60_000
  );
  if (loginFails.length >= 3) {
    out.push({
      severity: 'warn',
      title: `${loginFails.length} failed admin login attempts in last 15min`,
      detail: 'Possible brute-force; check /platform/events and consider rotating credentials.',
      link: '/platform/events',
    });
  }

  return out;
}

export default function PlatformHome() {
  usePlatformSocketAutoConnect();
  const { state, nodeMap, events, subscribe } = usePlatformSocket();
  const [workloadCount, setWorkloadCount] = useState<number | null>(null);
  const [initialEventsLoaded, setInitialEventsLoaded] = useState(false);
  const [, setTick] = useState(0);

  // Subscribe to events + every node we see.
  useEffect(() => {
    const unsubs: Array<() => void> = [subscribe('events')];
    return () => unsubs.forEach((fn) => fn());
  }, [subscribe]);

  useEffect(() => {
    const unsubs: Array<() => void> = [];
    for (const h of nodeMap.keys()) unsubs.push(subscribe(`node:${h}`));
    return () => unsubs.forEach((fn) => fn());
  }, [Array.from(nodeMap.keys()).sort().join(','), subscribe]);

  // Load initial snapshots once.
  useEffect(() => {
    api.platformNodes().catch(() => null);
    api.platformEvents(200).then(() => setInitialEventsLoaded(true)).catch(() => null);
    api.platformWorkloads().then(({ total }) => setWorkloadCount(total)).catch(() => null);
  }, []);

  // Re-render every 10s so relative timestamps stay fresh.
  useEffect(() => {
    const t = setInterval(() => setTick((x) => x + 1), 10_000);
    return () => clearInterval(t);
  }, []);

  const nodes = useMemo<PlatformNode[]>(
    () => Array.from(nodeMap.values()).sort((a, b) => a.hostname.localeCompare(b.hostname)),
    [nodeMap, initialEventsLoaded]
  );
  const healthyNodes = nodes.filter((n) => secondsSince(n.updatedAt) <= 90).length;
  const incidents = deriveIncidents(nodes, events);

  // Event-rate math for the summary card
  const eventsLastDay = useMemo(() => {
    const dayAgo = Date.now() - 86400_000;
    return events.filter((e) => new Date(e.ts).getTime() > dayAgo).length;
  }, [events]);

  const avgLoad = useMemo(() => {
    if (!nodes.length) return null;
    const sum = nodes.reduce((acc, n) => acc + (n.loadAvg?.[0] || 0), 0);
    return (sum / nodes.length).toFixed(2);
  }, [nodes]);

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">SpinForge cluster</h1>
          <p className="text-sm text-gray-500 mt-1">
            Everything that's happening, right now.
          </p>
        </div>
        <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs ${
          state === 'open' ? 'bg-green-100 text-green-700' :
          state === 'connecting' ? 'bg-amber-100 text-amber-800' :
          'bg-gray-100 text-gray-500'
        }`}>
          <span className={`h-1.5 w-1.5 rounded-full ${state === 'open' ? 'bg-green-500 animate-pulse' : 'bg-gray-400'}`} />
          live · {state}
        </span>
      </div>

      {/* Incident banner */}
      {incidents.length > 0 && (
        <div className={`border-l-4 rounded-lg p-4 ${
          incidents.some((i) => i.severity === 'error') ? 'border-red-500 bg-red-50' : 'border-amber-500 bg-amber-50'
        }`}>
          <div className="flex items-start gap-3">
            {incidents.some((i) => i.severity === 'error')
              ? <AlertCircle size={20} className="text-red-500 flex-shrink-0 mt-0.5" />
              : <AlertTriangle size={20} className="text-amber-500 flex-shrink-0 mt-0.5" />}
            <div className="flex-1">
              <div className="font-semibold text-gray-900 mb-1">
                {incidents.length} thing{incidents.length > 1 ? 's' : ''} need your attention
              </div>
              <ul className="space-y-1 text-sm">
                {incidents.map((i, idx) => (
                  <li key={idx} className="flex items-start justify-between gap-4">
                    <span>
                      <b className={i.severity === 'error' ? 'text-red-700' : 'text-amber-700'}>
                        {i.title}
                      </b>{' — '}{i.detail}
                    </span>
                    {i.link && (
                      <Link to={i.link} className="text-xs text-blue-600 hover:text-blue-800 flex items-center gap-1 whitespace-nowrap">
                        Go <ArrowRight size={12} />
                      </Link>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      )}
      {incidents.length === 0 && nodes.length > 0 && (
        <div className="bg-white border border-green-200 rounded-lg p-4 flex items-center gap-3">
          <div className="h-3 w-3 rounded-full bg-green-500 animate-pulse" />
          <span className="text-green-800 font-medium">All systems nominal.</span>
          <span className="text-sm text-gray-500">
            {healthyNodes}/{nodes.length} nodes healthy · {eventsLastDay} events in last 24h
          </span>
        </div>
      )}

      {/* Summary row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          icon={<Server size={20} />}
          label="Nodes"
          value={`${healthyNodes} / ${nodes.length || '—'}`}
          hint={nodes.length ? 'healthy / total' : 'waiting for heartbeats'}
          color="from-emerald-500 to-emerald-600"
          to="/platform/nodes"
        />
        <StatCard
          icon={<Package size={20} />}
          label="Workloads"
          value={workloadCount == null ? '—' : String(workloadCount)}
          hint="customer sites across the cluster"
          color="from-cyan-500 to-cyan-600"
          to="/platform/workloads"
        />
        <StatCard
          icon={<Activity size={20} />}
          label="Events · 24h"
          value={String(eventsLastDay)}
          hint={initialEventsLoaded ? 'on the platform stream' : 'loading…'}
          color="from-violet-500 to-violet-600"
          to="/platform/events"
        />
        <StatCard
          icon={<Zap size={20} />}
          label="Avg load"
          value={avgLoad ?? '—'}
          hint="1-minute, across nodes"
          color="from-orange-500 to-orange-600"
          to="/platform/nodes"
        />
      </div>

      {/* Quick actions */}
      <div>
        <div className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Quick actions</div>
        <div className="flex flex-wrap gap-2">
          <QuickAction to="/deploy" icon={<Plus size={14} />}>Deploy site</QuickAction>
          <QuickAction to="/partners" icon={<Briefcase size={14} />}>Manage partners</QuickAction>
          <QuickAction to="/customers" icon={<Users size={14} />}>Customers</QuickAction>
          <QuickAction to="/certificates" icon={<Shield size={14} />}>Certificates</QuickAction>
          <QuickAction to="/email-templates" icon={<RefreshCw size={14} />}>Email templates</QuickAction>
        </div>
      </div>

      {/* Nodes strip + events feed side-by-side on wide screens */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
        {/* Nodes */}
        <div className="lg:col-span-2 bg-white border rounded-lg p-4">
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-semibold flex items-center gap-2"><Server size={16} /> Nodes</h2>
            <Link to="/platform/nodes" className="text-xs text-blue-600 hover:text-blue-800 flex items-center gap-1">
              details <ArrowRight size={12} />
            </Link>
          </div>
          {nodes.length === 0 ? (
            <div className="text-sm text-gray-400 py-4 text-center">No heartbeats yet.</div>
          ) : (
            <ul className="space-y-2">
              {nodes.map((n) => {
                const age = secondsSince(n.updatedAt);
                const ok = age <= 90;
                const totalMem = n.memBytes?.total || 0;
                const usedMem = totalMem - (n.memBytes?.free || 0);
                const memPct = totalMem ? Math.round((usedMem / totalMem) * 100) : 0;
                return (
                  <li key={n.hostname} className="flex items-center gap-2 text-sm">
                    <span className={`h-2 w-2 rounded-full ${ok ? 'bg-green-500 animate-pulse' : 'bg-red-500'}`} />
                    <span className="font-mono flex-1 truncate">{n.hostname}</span>
                    <span className="text-xs text-gray-500 font-mono">
                      load {n.loadAvg?.[0].toFixed(2) || '—'} · mem {memPct}%
                    </span>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        {/* Events */}
        <div className="lg:col-span-3 bg-white border rounded-lg p-4">
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-semibold flex items-center gap-2"><Activity size={16} /> Latest events</h2>
            <Link to="/platform/events" className="text-xs text-blue-600 hover:text-blue-800 flex items-center gap-1">
              full feed <ArrowRight size={12} />
            </Link>
          </div>
          {events.length === 0 ? (
            <div className="text-sm text-gray-400 py-4 text-center">No events yet. Try deploying a site.</div>
          ) : (
            <ul className="space-y-1.5 text-xs font-mono">
              {events.slice(0, 20).map((e) => (
                <li key={e.id} className="flex items-center gap-2">
                  <span className={`h-1.5 w-1.5 rounded-full ${
                    e.severity === 'error' ? 'bg-red-500' :
                    e.severity === 'warn'  ? 'bg-amber-500' :
                                             'bg-blue-400'
                  }`} />
                  <span className="text-gray-500 w-16 text-right" title={e.ts}>{formatAgo(e.ts)}</span>
                  <span className="font-semibold">{e.type}</span>
                  <span className="text-gray-700 truncate flex-1">{e.subject}</span>
                  <span className="text-gray-400 text-[10px]">{e.source}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}

function StatCard({
  icon, label, value, hint, color, to,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  hint: string;
  color: string;
  to: string;
}) {
  return (
    <Link
      to={to}
      className="bg-white border rounded-lg p-4 hover:shadow-md transition-shadow block"
    >
      <div className="flex items-start justify-between mb-3">
        <div className={`h-9 w-9 rounded-lg bg-gradient-to-br ${color} text-white flex items-center justify-center`}>
          {icon}
        </div>
        <ArrowRight size={14} className="text-gray-300" />
      </div>
      <div className="text-xs text-gray-500">{label}</div>
      <div className="text-2xl font-bold text-gray-900 mt-1">{value}</div>
      <div className="text-xs text-gray-400 mt-0.5">{hint}</div>
    </Link>
  );
}

function QuickAction({ to, icon, children }: { to: string; icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <Link
      to={to}
      className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm bg-white border rounded-md hover:bg-gray-50 hover:border-gray-400 transition-colors"
    >
      {icon}{children}
    </Link>
  );
}
