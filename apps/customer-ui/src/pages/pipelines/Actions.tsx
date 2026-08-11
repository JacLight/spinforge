/**
 * SpinForge - Pipelines → Actions catalog
 *
 * Read-only browser for the action primitives customers can compose
 * into pipelines. The list + schemas come directly from building-api
 * and are informational — actions are code-defined, not editable here.
 */

import { useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import {
  BookOpen, RefreshCw, Package, Hammer, ShieldCheck, Send, Globe, Zap, Box, Search,
} from 'lucide-react';
import { buildApi, ActionDef, friendlyError } from '../../services/buildApi';

const CATEGORY_ORDER = ['source', 'build', 'sign', 'publish', 'host', 'util'];

function categoryIcon(category: string) {
  switch (category) {
    case 'source': return Package;
    case 'build':  return Hammer;
    case 'sign':   return ShieldCheck;
    case 'publish':return Send;
    case 'host':   return Globe;
    case 'util':   return Zap;
    default:       return Box;
  }
}

export default function Actions() {
  const [byCategory, setByCategory] = useState<Record<string, ActionDef[]>>({});
  const [count, setCount] = useState(0);
  const [selected, setSelected] = useState<string>('');
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [search, setSearch] = useState('');

  async function load() {
    setLoading(true);
    try {
      const r = await buildApi.listActions();
      setByCategory(r.byCategory || {});
      setCount(r.count || 0);
      const firstCat = CATEGORY_ORDER.find((c) => r.byCategory?.[c]?.length) || Object.keys(r.byCategory || {})[0] || '';
      if (!selected) setSelected(firstCat);
      setErr(null);
    } catch (e: any) {
      setErr(friendlyError(e));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const categories = useMemo(() => {
    const known = CATEGORY_ORDER.filter((c) => byCategory[c]?.length);
    const extras = Object.keys(byCategory).filter((c) => !known.includes(c));
    return [...known, ...extras];
  }, [byCategory]);

  const visible = (byCategory[selected] || []).filter((a) => {
    if (!search) return true;
    const q = search.toLowerCase();
    return (
      a.id.toLowerCase().includes(q) ||
      a.name?.toLowerCase().includes(q) ||
      a.description?.toLowerCase().includes(q)
    );
  });

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50">
      {/* Modern Header */}
      <div className="bg-white/80 backdrop-blur-lg border-b border-white/20 shadow-lg">
        <div className="px-6 lg:px-8">
          <div className="flex items-center justify-between h-20">
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 bg-gradient-to-r from-blue-600 to-purple-600 rounded-xl flex items-center justify-center">
                <BookOpen className="w-6 h-6 text-white" />
              </div>
              <div>
                <h1 className="text-2xl font-bold bg-gradient-to-r from-gray-900 to-gray-600 bg-clip-text text-transparent">
                  Actions catalog
                </h1>
                <p className="text-sm text-gray-500">
                  {count.toLocaleString()} action primitives · code-defined · used as stages in pipelines
                </p>
              </div>
            </div>

            <button
              onClick={load}
              disabled={loading}
              className="flex items-center space-x-2 px-6 py-3 bg-gradient-to-r from-blue-600 to-purple-600 text-white rounded-xl hover:from-blue-700 hover:to-purple-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 transition-all duration-200 shadow-lg hover:shadow-xl disabled:opacity-50"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
              <span className="text-sm font-medium">Reload</span>
            </button>
          </div>
        </div>
      </div>

      <div className="px-6 lg:px-8 py-8">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="space-y-8"
        >
          {/* Search bar */}
          <motion.div
            className="bg-white/80 backdrop-blur-sm rounded-2xl border border-white/20 shadow-lg p-6"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.1 }}
          >
            <div className="relative">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search actions by id, name, or description..."
                className="pl-12 pr-4 py-3 w-full bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200"
              />
            </div>
          </motion.div>

          {err && (
            <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-sm text-red-700">{err}</div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-[260px_1fr] gap-6">
            {/* LEFT: categories */}
            <aside className="bg-white/80 backdrop-blur-sm rounded-2xl border border-white/20 shadow-lg p-4 space-y-1 h-fit">
              <div className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2 px-2">
                Categories
              </div>
              {categories.length === 0 ? (
                <div className="text-xs text-gray-400 italic p-2">No actions loaded.</div>
              ) : categories.map((cat) => {
                const Icon = categoryIcon(cat);
                const n = byCategory[cat]?.length || 0;
                const isActive = selected === cat;
                return (
                  <button
                    key={cat}
                    onClick={() => { setSelected(cat); setExpandedId(null); }}
                    className={`flex items-center w-full gap-2 px-3 py-2.5 rounded-xl text-sm text-left transition-all duration-200 ${
                      isActive
                        ? 'bg-gradient-to-r from-blue-600 to-purple-600 text-white shadow-lg scale-[1.02]'
                        : 'hover:bg-white/80 text-gray-700 hover:shadow-md'
                    }`}
                  >
                    <Icon className={`h-4 w-4 ${isActive ? 'text-white' : 'text-gray-500'}`} />
                    <span className="flex-1 capitalize font-medium">{cat}</span>
                    <span className={`text-[11px] px-1.5 py-0.5 rounded-full ${
                      isActive ? 'bg-white/20 text-white' : 'bg-gray-100 text-gray-600'
                    }`}>
                      {n}
                    </span>
                  </button>
                );
              })}
            </aside>

            {/* RIGHT: action cards */}
            <div className="space-y-3">
              {visible.length === 0 ? (
                <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-12 text-center">
                  <Box className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                  <h3 className="text-lg font-medium text-gray-900 mb-2">
                    {search ? 'No matching actions' : 'No actions in this category'}
                  </h3>
                  <p className="text-gray-600">
                    {search ? 'Try a different search term' : 'Pick another category to browse'}
                  </p>
                </div>
              ) : visible.map((a) => {
                const isOpen = expandedId === a.id;
                const Icon = categoryIcon(a.category);
                return (
                  <div
                    key={a.id}
                    className="bg-white rounded-xl border border-gray-200 shadow-sm hover:shadow-md hover:border-blue-200 transition-all duration-200 overflow-hidden"
                  >
                    <div className="p-4 flex items-start justify-between gap-3">
                      <div className="flex items-start gap-3 min-w-0 flex-1">
                        <div className="w-10 h-10 bg-gradient-to-r from-blue-500 to-purple-500 rounded-xl flex items-center justify-center flex-shrink-0 shadow-sm">
                          <Icon className="w-5 h-5 text-white" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <code className="bg-gradient-to-r from-blue-500/10 to-purple-500/10 text-gray-800 px-2 py-0.5 rounded-md text-sm font-semibold">
                              {a.id}
                            </code>
                            <span className="text-[11px] text-gray-400">v{a.version}</span>
                            {a.runner?.kind && (
                              <code className="bg-gray-100 px-1.5 py-0.5 rounded text-[10px] text-gray-600">
                                {a.runner.kind}
                              </code>
                            )}
                          </div>
                          <div className="text-sm font-semibold text-gray-900 mt-1">{a.name}</div>
                          {a.description && (
                            <div className="text-xs text-gray-500 mt-1">{a.description}</div>
                          )}
                        </div>
                      </div>
                      <button
                        onClick={() => setExpandedId(isOpen ? null : a.id)}
                        className="text-xs font-medium text-blue-600 hover:text-blue-800 whitespace-nowrap px-3 py-1.5 rounded-lg hover:bg-blue-50 transition-all duration-200"
                      >
                        {isOpen ? 'Hide schemas' : 'View schemas'}
                      </button>
                    </div>
                    {isOpen && (
                      <div className="border-t border-gray-100 bg-gradient-to-br from-blue-50/30 to-purple-50/30 p-4 grid grid-cols-1 lg:grid-cols-2 gap-3">
                        <div>
                          <div className="text-xs font-semibold text-gray-700 mb-2 flex items-center gap-1.5">
                            <span className="w-1.5 h-1.5 rounded-full bg-blue-500" />
                            Inputs
                          </div>
                          <pre className="text-[11px] font-mono bg-gray-900 text-gray-100 rounded-xl px-3 py-2 overflow-auto max-h-80 leading-relaxed">
                            {JSON.stringify(a.inputs, null, 2)}
                          </pre>
                        </div>
                        <div>
                          <div className="text-xs font-semibold text-gray-700 mb-2 flex items-center gap-1.5">
                            <span className="w-1.5 h-1.5 rounded-full bg-purple-500" />
                            Outputs
                          </div>
                          <pre className="text-[11px] font-mono bg-gray-900 text-gray-100 rounded-xl px-3 py-2 overflow-auto max-h-80 leading-relaxed">
                            {JSON.stringify(a.outputs, null, 2)}
                          </pre>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </motion.div>
      </div>
    </div>
  );
}
