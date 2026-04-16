/**
 * Live WebSocket to /_admin/platform/subscribe.
 *
 * One instance per app — the hook is memoized against a global so
 * every component that uses it shares the same underlying socket.
 * Topic subscriptions from multiple components fan in: when any
 * component subscribes to a topic we subscribe once on the wire;
 * when all components unsubscribe we unsubscribe once.
 *
 * Usage:
 *   // In a component that cares about live events:
 *   const { events, nodes, state, subscribe } = usePlatformSocket();
 *   useEffect(() => {
 *     const unsub = subscribe('events');
 *     return unsub;
 *   }, [subscribe]);
 *
 * Auto-reconnects with exponential backoff (1s, 2s, 4s, capped 30s)
 * when the socket drops. On reconnect, re-applies every active
 * subscription so consumers don't see a gap in their streams.
 */

import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react';

export interface PlatformEvent {
  id: string;
  type: string;
  subject: string;
  severity: 'info' | 'warn' | 'error';
  source: string;
  ts: string;
  context: string; // raw JSON string from redis; caller may JSON.parse
}

export interface PlatformNode {
  hostname: string;
  ip: string | null;
  role?: string;
  spinforgeVersion?: string;
  startedAt?: string;
  updatedAt: string;
  nodeUptimeSec?: number;
  loadAvg?: [number, number, number];
  memBytes?: { total: number; free: number };
  cpus?: number;
  docker?: any;
}

type ConnState = 'idle' | 'connecting' | 'open' | 'closed';

interface SocketStore {
  ws: WebSocket | null;
  state: ConnState;
  refCounts: Map<string, number>;      // topic → active subscriber count
  events: PlatformEvent[];             // rolling buffer (newest first)
  nodes: Map<string, PlatformNode>;    // hostname → latest state
  listeners: Set<() => void>;
  backoffMs: number;
  reconnectTimer: number | null;
}

const MAX_EVENTS = 1000;
const MAX_BACKOFF_MS = 30_000;

// Global singleton — every hook call sees the same socket.
let store: SocketStore | null = null;

function getStore(): SocketStore {
  if (!store) {
    store = {
      ws: null,
      state: 'idle',
      refCounts: new Map(),
      events: [],
      nodes: new Map(),
      listeners: new Set(),
      backoffMs: 1000,
      reconnectTimer: null,
    };
  }
  return store;
}

function notify() {
  for (const fn of getStore().listeners) { try { fn(); } catch { /* ignore */ } }
}

function wsUrl(): string {
  const proto = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  const host = window.location.host;
  // The API is served on the same origin via the admin UI's reverse
  // proxy (openresty); /_admin/platform/subscribe is under /_admin.
  return `${proto}//${host}/_admin/platform/subscribe`;
}

function applySubscriptions(s: SocketStore) {
  if (!s.ws || s.ws.readyState !== WebSocket.OPEN) return;
  for (const topic of s.refCounts.keys()) {
    try { s.ws.send(JSON.stringify({ op: 'subscribe', topic })); } catch { /* ignore */ }
  }
}

function connect() {
  const s = getStore();
  if (s.state === 'connecting' || s.state === 'open') return;

  const token = localStorage.getItem('adminToken') || '';
  s.state = 'connecting';
  notify();

  // We can't set Authorization headers on a browser WebSocket.
  // Pass the JWT via ?token= query param; the server's upgrade
  // handler reads it alongside the Authorization header path.
  const url = `${wsUrl()}?token=${encodeURIComponent(token)}`;
  const ws = new WebSocket(url);
  s.ws = ws;

  ws.addEventListener('open', () => {
    s.state = 'open';
    s.backoffMs = 1000;
    applySubscriptions(s);
    notify();
  });

  ws.addEventListener('message', (ev) => {
    let msg: any;
    try { msg = JSON.parse(ev.data); } catch { return; }
    if (!msg) return;

    if (msg.type === 'hello' || msg.type === 'pong' || msg.type === 'subscribed' || msg.type === 'unsubscribed') {
      return; // control frames, no state change
    }
    if (msg.type === 'error') {
      console.warn('[platform-ws] server error:', msg.message);
      return;
    }

    if (msg.topic === 'events' && msg.event) {
      s.events.unshift(msg.event);
      if (s.events.length > MAX_EVENTS) s.events.length = MAX_EVENTS;
      notify();
      return;
    }

    if (typeof msg.topic === 'string' && msg.topic.startsWith('node:')) {
      const hostname = msg.topic.slice('node:'.length);
      if (msg.gone) {
        s.nodes.delete(hostname);
      } else if (msg.node) {
        s.nodes.set(hostname, msg.node);
      }
      notify();
      return;
    }
  });

  const scheduleReconnect = () => {
    s.state = 'closed';
    s.ws = null;
    notify();
    if (s.reconnectTimer) window.clearTimeout(s.reconnectTimer);
    s.reconnectTimer = window.setTimeout(() => {
      s.reconnectTimer = null;
      s.backoffMs = Math.min(s.backoffMs * 2, MAX_BACKOFF_MS);
      connect();
    }, s.backoffMs);
  };

  ws.addEventListener('close', scheduleReconnect);
  ws.addEventListener('error', () => { try { ws.close(); } catch { /* noop */ } });
}

function subscribe(topic: string): () => void {
  const s = getStore();
  const current = s.refCounts.get(topic) || 0;
  s.refCounts.set(topic, current + 1);

  if (s.state !== 'open' && s.state !== 'connecting') {
    connect();
  } else if (current === 0 && s.ws && s.ws.readyState === WebSocket.OPEN) {
    try { s.ws.send(JSON.stringify({ op: 'subscribe', topic })); } catch { /* noop */ }
  }

  return () => {
    const rc = (s.refCounts.get(topic) || 0) - 1;
    if (rc <= 0) {
      s.refCounts.delete(topic);
      if (s.ws && s.ws.readyState === WebSocket.OPEN) {
        try { s.ws.send(JSON.stringify({ op: 'unsubscribe', topic })); } catch { /* noop */ }
      }
    } else {
      s.refCounts.set(topic, rc);
    }
  };
}

// useSyncExternalStore gives us a cheap way to re-render whenever
// notify() fires. Each hook snapshot captures the current shape of
// the store for the callers that subscribe.
function subscribeStore(listener: () => void): () => void {
  const s = getStore();
  s.listeners.add(listener);
  return () => { s.listeners.delete(listener); };
}

function getSnapshot() {
  const s = getStore();
  return s.state + '|' + s.events.length + '|' + s.nodes.size;
}

export function usePlatformSocket() {
  // Force the hook to tear down and rebuild when the store updates.
  useSyncExternalStore(subscribeStore, getSnapshot, getSnapshot);
  const s = getStore();

  // Stable callbacks so consumers' effect deps don't churn on every tick.
  const sub = useCallback((topic: string) => subscribe(topic), []);

  return useMemo(() => ({
    state: s.state,
    events: s.events,
    nodes: Array.from(s.nodes.values()),
    nodeMap: s.nodes,
    subscribe: sub,
  }), [s.state, s.events, s.nodes.size, sub]);
}

// Auto-connect the first time any consumer mounts.
export function usePlatformSocketAutoConnect() {
  useEffect(() => {
    connect();
  }, []);
}
