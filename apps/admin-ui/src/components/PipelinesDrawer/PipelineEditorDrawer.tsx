/**
 * SpinForge - Pipelines → Editor drawer (create + edit)
 *
 * Three-section form, single scroll:
 *   1. Pipeline type  — card grid that picks the build recipe
 *   2. Source         — git or zip (pipeline-level, not a stage)
 *   3. Stages         — pre-filled from the recipe. Pipelines are
 *                       LINEAR: stage N runs after stage N-1. The UI
 *                       shows stages in order and we recompute the
 *                       `needs` chain at save time from that order.
 *
 * Matches the shape of Jenkins/CircleCI/Vercel: the "what kind of
 * pipeline is this" question is answered first, sources and stages
 * follow. Styling tokens align with ApplicationDrawer — same input
 * chain, same pill/toggle/card patterns.
 */

import { useEffect, useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Workflow, Save, Plus, Trash2, ArrowUp, ArrowDown, CheckCircle2,
  AlertTriangle, Loader2, X, Settings, Sliders,
  Globe, Package, Smartphone, Box, GitBranch, Upload, ChevronDown,
  Check, Eye, EyeOff, Info,
} from 'lucide-react';
import {
  buildApi, ActionDef, Pipeline, PipelineType, PipelineSource,
  Stage, PipelineValidationError, friendlyError,
} from '../../services/buildApi';
import { useConfirm } from '../ConfirmModal';

// ─── Pipeline type catalog ─────────────────────────────────────────────

interface PipelineTypeDef {
  id: PipelineType;
  name: string;
  description: string;
  icon: any;
}

const PIPELINE_TYPES: PipelineTypeDef[] = [
  { id: 'static-site',  name: 'Static site',    description: 'HTML/CSS/JS, framework build, served at a domain.', icon: Globe },
  { id: 'node-service', name: 'Node.js service', description: 'Node app, builds a zipped dist you can host or download.', icon: Package },
  { id: 'ios-app',      name: 'iOS app',        description: 'Xcode archive → signed IPA → App Store / TestFlight.', icon: Smartphone },
  { id: 'android-app',  name: 'Android app',    description: 'Gradle bundle → signed AAB → Play Store.', icon: Smartphone },
  { id: 'container',    name: 'Container',      description: 'Docker image → registry → Nomad service.', icon: Box },
  { id: 'custom',       name: 'Custom',         description: 'Build from scratch, no presets.', icon: Workflow },
];

// ─── Recipes ───────────────────────────────────────────────────────────
//
// Each recipe is the ordered list of stages we pre-fill when the user
// picks a type. `needs` is NOT set here — we always recompute it at
// save time from list order so the chain stays linear even after the
// user reorders or disables stages.

function stage(
  id: string, name: string, action: string,
  withs: Record<string, any>,
  overrides: Partial<Stage> = {},
): Stage {
  return {
    id,
    name,
    action,
    with: withs,
    needs: [],
    enabled: true,
    continueOnError: false,
    timeoutSec: 600,
    ...overrides,
  };
}

const TYPE_RECIPES: Record<PipelineType, Stage[]> = {
  'static-site': [
    stage('install',  'Install dependencies', 'install.npm',         { install: 'npm ci' }),
    stage('test',     'Run tests',             'test.npm',            { command: 'npm test' }),
    stage('build',    'Build static',          'build.static',        { command: 'npm run build', outputDir: 'dist' }),
    stage('package',  'Package artifact',      'package.zip',         { source: '${stages.build.outputs.artifactPath}' }, { timeoutSec: 300 }),
    stage('deploy',   'Deploy site',           'deploy.static-site',  { domain: '', artifact: '${stages.build.outputs.artifactPath}' }, { timeoutSec: 300 }),
  ],
  'node-service': [
    stage('install', 'Install dependencies', 'install.npm', { install: 'npm ci' }),
    stage('test',    'Run tests',             'test.npm',    { command: 'npm test' }),
    stage('build',   'Build node',            'build.node',  { install: 'npm ci', command: 'npm run build', outputDir: 'dist' }, { timeoutSec: 1800 }),
    stage('package', 'Package artifact',      'package.zip', { source: 'dist' }, { timeoutSec: 300 }),
  ],
  'ios-app': [
    stage('install',  'Install CocoaPods',     'install.cocoapods',  { directory: 'ios' }, { timeoutSec: 600 }),
    stage('test',     'Run Xcode tests',        'test.xcode',         { scheme: '' }, { timeoutSec: 1800 }),
    stage('build',    'Archive iOS',            'build.ios',          { scheme: '' }, { timeoutSec: 3600 }),
    stage('sign',     'Sign → IPA',             'sign.ios',           { signingProfileId: '', archive: '${stages.build.outputs.archivePath}' }, { timeoutSec: 600 }),
    stage('publish',  'Upload to App Store',    'publish.appstore',   { ipa: '${stages.sign.outputs.ipaPath}', credentialsRef: '', track: 'testflight' }, { timeoutSec: 1800 }),
  ],
  'android-app': [
    stage('install', 'Install Gradle deps',   'install.gradle',     { wrapper: true }, { timeoutSec: 1200 }),
    stage('test',    'Run Gradle tests',       'test.gradle',        { task: 'test' }, { timeoutSec: 1800 }),
    stage('build',   'Gradle bundleRelease',   'build.android',      { task: 'bundleRelease' }, { timeoutSec: 3600 }),
    stage('sign',    'Sign AAB',               'sign.android',       { signingProfileId: '', artifact: '${stages.build.outputs.artifactPath}' }, { timeoutSec: 600 }),
    stage('publish', 'Upload to Play Store',   'publish.playstore',  { aab: '${stages.sign.outputs.signedPath}', credentialsRef: '', track: 'internal' }, { timeoutSec: 1800 }),
  ],
  'container': [
    stage('install', 'Install dependencies', 'install.npm',       { install: 'npm ci' }),
    stage('test',    'Run tests',             'test.npm',          { command: 'npm test' }),
    stage('build',   'Build container image',  'build.container',   { dockerfile: 'Dockerfile', context: '.' }, { timeoutSec: 1800 }),
    stage('publish', 'Push to registry',       'publish.registry',  { imageRef: '${stages.build.outputs.imageRef}' }, { timeoutSec: 900 }),
    stage('deploy',  'Deploy container',       'deploy.container',  { domain: '', imageRef: '${stages.publish.outputs.pushedRef}', port: 80 }, { timeoutSec: 300 }),
  ],
  'custom': [],
};

// ─── Helpers ───────────────────────────────────────────────────────────

function emptyStage(id = 'stage-1'): Stage {
  return { id, name: '', action: '', with: {}, needs: [], enabled: true, continueOnError: false, timeoutSec: 600 };
}

function isPlainObject(v: any) {
  return v !== null && typeof v === 'object' && !Array.isArray(v);
}

function schemaProps(inputs: any): Array<[string, any, boolean]> {
  if (!isPlainObject(inputs) || !isPlainObject(inputs.properties)) return [];
  const req: string[] = Array.isArray(inputs.required) ? inputs.required : [];
  return Object.entries(inputs.properties).map(([k, s]) => [k, s, req.includes(k)] as [string, any, boolean]);
}

// Strip runtime-only + disabled-metadata fields before sending to the
// server. Keeps validation errors pointing at the fields the user cares
// about rather than at ${status}/${attempt}/etc.
function cleanStageForWire(s: Stage): Stage {
  return {
    id: s.id,
    name: s.name,
    action: s.action,
    actionVersion: s.actionVersion,
    with: s.with || {},
    needs: s.needs || [],
    enabled: s.enabled !== false,
    continueOnError: !!s.continueOnError,
    timeoutSec: s.timeoutSec ?? null,
  };
}

// Linear needs chain: first stage has no needs; every other stage's
// `needs` points at the previous stage's id. Disabled stages are NOT
// skipped here — we always reference the immediate predecessor and let
// the build runtime's disabled-stage bypass handle the skip.
function computeLinearNeeds(stages: Stage[]): Stage[] {
  return stages.map((s, i) => ({
    ...s,
    needs: i === 0 ? [] : [stages[i - 1].id],
  }));
}

// ─── Which input fields span the full card width ──────────────────────
//
// Plain scalars (strings, numbers, enums, bools) live in the 2-col grid;
// JSON / object / array fields render as full-width textareas.
function isWideField(schema: any): boolean {
  const t = schema?.type;
  if (t === 'object' || t === 'array') return true;
  if (!t) return true; // unknown → safe to be wide
  return false;
}

// ─── Shared input token chain ──────────────────────────────────────────

const INPUT_CLS =
  'w-full px-3 py-2 bg-white border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200';

// ─── Switch (toggle) — copied from AdvancedSettingsTab ─────────────────

function Switch({
  checked, onChange, labelOn = 'Enabled', labelOff = 'Disabled',
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  labelOn?: string;
  labelOff?: string;
}) {
  return (
    <div className="flex items-center gap-3">
      <label className="relative inline-flex items-center cursor-pointer">
        <input
          type="checkbox"
          checked={checked}
          onChange={(e) => onChange(e.target.checked)}
          className="sr-only peer"
        />
        <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600" />
      </label>
      <span
        className={`px-2 py-1 rounded text-xs font-medium ${
          checked ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-700'
        }`}
      >
        {checked ? labelOn : labelOff}
      </span>
    </div>
  );
}

// ─── Native select dressed up to match input tokens ───────────────────

function FancySelect({
  value, onChange, children, className = '',
}: {
  value: string;
  onChange: (v: string) => void;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={`relative ${className}`}>
      <select
        className={`${INPUT_CLS} appearance-none pr-9`}
        value={value}
        onChange={(e) => onChange(e.target.value)}
      >
        {children}
      </select>
      <ChevronDown className="h-4 w-4 text-gray-400 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
    </div>
  );
}

// ─── Auto-generated per-stage input field ──────────────────────────────

function InputField({
  name, schema, required, value, onChange,
}: {
  name: string;
  schema: any;
  required: boolean;
  value: any;
  onChange: (v: any) => void;
}) {
  const type = schema?.type;
  const desc = schema?.description as string | undefined;
  const def = schema?.default;

  const label = (
    <label className="block text-xs font-medium text-gray-700 mb-1.5">
      <code className="bg-gray-100 px-1.5 py-0.5 rounded">{name}</code>
      {required && <span className="text-red-600"> *</span>}
      {type && <span className="text-gray-400 ml-2 font-normal">{type}</span>}
    </label>
  );

  const help = desc && (
    <div className="text-[11px] text-gray-500 mt-1.5 italic">{desc}</div>
  );

  if (type === 'boolean') {
    return (
      <div>
        {label}
        <Switch
          checked={Boolean(value ?? def ?? false)}
          onChange={(v) => onChange(v)}
          labelOn="true"
          labelOff="false"
        />
        {help}
      </div>
    );
  }

  if (type === 'number' || type === 'integer') {
    return (
      <div>
        {label}
        <input
          type="number"
          className={INPUT_CLS}
          placeholder={def != null ? String(def) : ''}
          value={value ?? ''}
          onChange={(e) => {
            const v = e.target.value;
            if (v === '') onChange(undefined);
            else onChange(type === 'integer' ? parseInt(v, 10) : parseFloat(v));
          }}
        />
        {help}
      </div>
    );
  }

  if (type === 'string') {
    if (Array.isArray(schema?.enum)) {
      return (
        <div>
          {label}
          <FancySelect
            value={value ?? def ?? ''}
            onChange={(v) => onChange(v || undefined)}
          >
            <option value="">{required ? '(pick one)' : '(none)'}</option>
            {schema.enum.map((v: any) => (
              <option key={String(v)} value={String(v)}>{String(v)}</option>
            ))}
          </FancySelect>
          {help}
        </div>
      );
    }
    return (
      <div>
        {label}
        <input
          type="text"
          className={`${INPUT_CLS} font-mono`}
          placeholder={def != null ? String(def) : ''}
          value={value ?? ''}
          onChange={(e) => onChange(e.target.value || undefined)}
        />
        {help}
      </div>
    );
  }

  // object / array / unknown — JSON textarea
  return <JsonField label={label} help={help} def={def} value={value} onChange={onChange} />;
}

function JsonField({
  label, help, def, value, onChange,
}: {
  label: React.ReactNode;
  help: React.ReactNode;
  def: any;
  value: any;
  onChange: (v: any) => void;
}) {
  const [raw, setRaw] = useState<string>(() => {
    if (value === undefined) return '';
    try { return JSON.stringify(value, null, 2); } catch { return ''; }
  });
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    try {
      const current = raw === '' ? undefined : JSON.parse(raw);
      if (JSON.stringify(current) === JSON.stringify(value)) return;
    } catch { /* leave raw alone if not parseable */ }
    try { setRaw(value === undefined ? '' : JSON.stringify(value, null, 2)); } catch {}
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  return (
    <div>
      {label}
      <div className="relative">
        <textarea
          className={`${INPUT_CLS} font-mono text-xs min-h-[100px] pr-14`}
          placeholder={def != null ? JSON.stringify(def) : '{ }'}
          value={raw}
          onChange={(e) => {
            const v = e.target.value;
            setRaw(v);
            if (v === '') { onChange(undefined); setErr(null); return; }
            try {
              onChange(JSON.parse(v));
              setErr(null);
            } catch (e: any) {
              setErr(e.message);
            }
          }}
        />
        <span className="absolute top-2 right-2 text-[9px] font-semibold tracking-wide px-1.5 py-0.5 rounded bg-gradient-to-r from-blue-500/10 to-purple-500/10 text-blue-700 border border-blue-200/60">
          JSON
        </span>
      </div>
      {err && <div className="text-[11px] text-red-600 mt-1">JSON: {err}</div>}
      {help}
    </div>
  );
}

// ─── Drawer ────────────────────────────────────────────────────────────

interface Props {
  isOpen: boolean;
  onClose: () => void;
  pipeline: Pipeline | null; // null → create mode
  onSaved?: (p: Pipeline) => void;
}

export default function PipelineEditorDrawer({ isOpen, onClose, pipeline, onSaved }: Props) {
  const isEdit = Boolean(pipeline);
  const confirm = useConfirm();

  const [customerId, setCustomerId] = useState('');
  const [customerList, setCustomerList] = useState<Array<{ id: string; name?: string }>>([]);
  const [loadingCustomers, setLoadingCustomers] = useState(false);

  const [name, setName] = useState('');
  const [triggerType, setTriggerType] = useState<'manual' | 'cron' | 'webhook'>('manual');
  const [type, setType] = useState<PipelineType>('custom');

  // Source state — independent of type so users can toggle between
  // git/zip without losing what they typed.
  const [sourceType, setSourceType] = useState<'git' | 'zip'>('zip');
  const [gitUrl, setGitUrl] = useState('');
  const [gitRef, setGitRef] = useState('main');
  const [gitDepth, setGitDepth] = useState<number>(1);
  const [gitToken, setGitToken] = useState('');
  const [showGitToken, setShowGitToken] = useState(false);

  const [stages, setStages] = useState<Stage[]>([]);
  // Per-stage "change action" reveal. Recipes default to locked so the
  // user can't accidentally re-pick an action mid-recipe. Click the
  // "Change action" link inside a card to reveal the dropdown.
  const [actionPickerOpen, setActionPickerOpen] = useState<Record<number, boolean>>({});

  const [actions, setActions] = useState<ActionDef[] | null>(null);
  const [actionsByCategory, setActionsByCategory] = useState<Record<string, ActionDef[]>>({});
  const [loadingInitial, setLoadingInitial] = useState(true);
  const [saving, setSaving] = useState(false);
  const [validating, setValidating] = useState(false);
  const [validationErrors, setValidationErrors] = useState<PipelineValidationError[]>([]);
  const [validationOk, setValidationOk] = useState<boolean | null>(null);
  const [err, setErr] = useState<string | null>(null);

  // Load customer list once when the drawer opens.
  useEffect(() => {
    if (!isOpen) return;
    let canceled = false;
    setLoadingCustomers(true);
    buildApi.listCustomers()
      .then((r) => { if (!canceled) setCustomerList((r.customers || []).map((c: any) => ({ id: c.id, name: c.name }))); })
      .catch(() => {})
      .finally(() => { if (!canceled) setLoadingCustomers(false); });
    return () => { canceled = true; };
  }, [isOpen]);

  // Reset form whenever the drawer opens or the target pipeline changes.
  useEffect(() => {
    if (!isOpen) return;
    setErr(null);
    setValidationErrors([]);
    setValidationOk(null);
    setActionPickerOpen({});
    setShowGitToken(false);
    (async () => {
      setLoadingInitial(true);
      try {
        const cat = await buildApi.listActions();
        setActions(cat.actions);
        setActionsByCategory(cat.byCategory || {});
        if (pipeline) {
          setCustomerId(pipeline.customerId);
          setName(pipeline.name);
          setTriggerType((pipeline.trigger?.type as any) || 'manual');
          setType((pipeline.type as PipelineType) || 'custom');
          const src = pipeline.source || { type: 'zip' };
          setSourceType(src.type);
          setGitUrl(src.url || '');
          setGitRef(src.ref || 'main');
          setGitDepth(src.depth || 1);
          setGitToken(src.token || '');
          setStages(
            pipeline.stages?.length
              ? pipeline.stages.map((s) => ({ ...s, enabled: s.enabled !== false }))
              : [emptyStage()]
          );
        } else {
          // Fresh create — default to 'custom' (no stages) so the user
          // picks a type deliberately. Picking triggers the recipe.
          setCustomerId('');
          setName('');
          setTriggerType('manual');
          setType('custom');
          setSourceType('zip');
          setGitUrl('');
          setGitRef('main');
          setGitDepth(1);
          setGitToken('');
          setStages([]);
        }
      } catch (e: any) {
        setErr(friendlyError(e));
      } finally {
        setLoadingInitial(false);
      }
    })();
  }, [isOpen, pipeline]);

  const actionById = useMemo(() => {
    const m = new Map<string, ActionDef>();
    (actions ?? []).forEach((a) => m.set(a.id, a));
    return m;
  }, [actions]);

  function updateStage(idx: number, patch: Partial<Stage>) {
    setStages((prev) => prev.map((s, i) => (i === idx ? { ...s, ...patch } : s)));
  }

  function addStage() {
    setStages((prev) => [...prev, emptyStage(`stage-${prev.length + 1}`)]);
    // Open the action picker for the new stage so the user picks one.
    setActionPickerOpen((m) => ({ ...m, [stages.length]: true }));
  }

  function removeStage(idx: number) {
    setStages((prev) => prev.filter((_, i) => i !== idx));
  }

  function moveStage(idx: number, delta: number) {
    setStages((prev) => {
      const next = [...prev];
      const target = idx + delta;
      if (target < 0 || target >= next.length) return prev;
      [next[idx], next[target]] = [next[target], next[idx]];
      return next;
    });
  }

  async function handleTypeChange(newType: PipelineType) {
    if (newType === type) return;
    const hasStages = stages.length > 0 && stages.some((s) => s.action);
    if (hasStages) {
      const nice = PIPELINE_TYPES.find((p) => p.id === newType)?.name || newType;
      const count = stages.length;
      const ok = await confirm({
        title: `Switch to ${nice} recipe?`,
        description: `This replaces your ${count} current stage${count === 1 ? '' : 's'} with the preset for ${nice}. You'll lose any edits you made to the current stages.`,
        confirmLabel: 'Replace stages',
        cancelLabel: 'Keep current',
        severity: 'warning',
      });
      if (!ok) return;
    }
    setType(newType);
    // Deep-clone the recipe so in-place mutations don't leak across
    // pipelines. needs is always recomputed at save time.
    const recipe = TYPE_RECIPES[newType].map((s) => ({
      ...s, with: { ...(s.with || {}) }, needs: [],
    }));
    setStages(recipe);
    setActionPickerOpen({});
  }

  async function handleValidate() {
    setValidating(true);
    setValidationErrors([]);
    setValidationOk(null);
    try {
      const wire = computeLinearNeeds(stages).map(cleanStageForWire);
      const r = await buildApi.validatePipeline(wire);
      setValidationOk(r.valid);
      setValidationErrors(r.errors || []);
    } catch (e: any) {
      setErr(friendlyError(e));
    } finally {
      setValidating(false);
    }
  }

  function buildSource(): PipelineSource {
    if (sourceType === 'zip') return { type: 'zip' };
    const out: PipelineSource = { type: 'git', url: gitUrl, ref: gitRef || 'main', depth: gitDepth || 1 };
    if (gitToken) out.token = gitToken;
    return out;
  }

  async function handleSave() {
    setSaving(true);
    setErr(null);
    setValidationErrors([]);
    try {
      const trigger = { type: triggerType };
      const source = buildSource();
      // Recompute linear needs chain from list order before serializing.
      const outStages = computeLinearNeeds(stages).map(cleanStageForWire);
      let result: Pipeline;
      if (isEdit && pipeline) {
        result = await buildApi.updatePipeline(pipeline.id, { name, type, source, stages: outStages, trigger });
      } else {
        result = await buildApi.createPipeline({ customerId, name, type, source, stages: outStages, trigger });
      }
      onSaved?.(result);
    } catch (e: any) {
      const details = e?.response?.data?.details;
      if (Array.isArray(details)) setValidationErrors(details);
      setErr(friendlyError(e));
    } finally {
      setSaving(false);
    }
  }

  const errorsByStage = useMemo(() => {
    const m = new Map<number, PipelineValidationError[]>();
    validationErrors.forEach((e) => {
      const arr = m.get(e.stageIndex) ?? [];
      arr.push(e);
      m.set(e.stageIndex, arr);
    });
    return m;
  }, [validationErrors]);

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
          />

          {/* Drawer */}
          <motion.div
            className="fixed right-0 top-0 h-full w-full max-w-5xl bg-gradient-to-br from-white via-blue-50/30 to-purple-50/30 shadow-2xl z-50 flex flex-col overflow-hidden"
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ type: 'spring', damping: 25, stiffness: 250 }}
          >
            {/* Glassmorphic Header */}
            <div className="relative bg-white/70 backdrop-blur-2xl border-b border-white/50 shadow-lg">
              {/* Gradient orbs */}
              <div className="absolute inset-0 overflow-hidden">
                <div className="absolute -top-10 -right-10 w-40 h-40 bg-blue-400/20 rounded-full blur-3xl" />
                <div className="absolute -bottom-10 -left-10 w-40 h-40 bg-purple-400/20 rounded-full blur-3xl" />
              </div>

              <div className="relative px-8 py-6">
                <div className="flex items-start justify-between mb-6">
                  <div>
                    <div className="flex items-center gap-3 mb-2">
                      <h2 className="text-3xl font-bold bg-gradient-to-r from-blue-600 via-purple-600 to-pink-600 bg-clip-text text-transparent">
                        {isEdit ? pipeline?.name : 'New Pipeline'}
                      </h2>
                      <div className="px-2 py-1 rounded-full text-xs font-semibold flex items-center gap-1 bg-blue-100 text-blue-700">
                        <div className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-pulse" />
                        {isEdit ? 'Editing' : 'Draft'}
                      </div>
                    </div>
                    <div className="flex items-center gap-4 text-sm text-gray-600">
                      <span className="px-2 py-0.5 bg-gradient-to-r from-blue-500/10 to-purple-500/10 rounded-md text-xs font-medium text-gray-700">
                        {isEdit ? 'Edit pipeline' : 'Create pipeline'}
                      </span>
                      {isEdit && pipeline && (
                        <span className="font-mono text-xs text-gray-500">{pipeline.id}</span>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-3">
                    <motion.button
                      whileHover={{ scale: 1.05 }}
                      whileTap={{ scale: 0.95 }}
                      onClick={handleValidate}
                      disabled={validating || loadingInitial}
                      className="group p-2.5 bg-white/80 backdrop-blur-xl border border-gray-200 text-gray-700 rounded-xl hover:bg-gray-50 transition-all duration-200 shadow-lg hover:shadow-xl disabled:opacity-50"
                      title="Validate"
                    >
                      {validating ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <CheckCircle2 className="h-4 w-4" />
                      )}
                    </motion.button>

                    <motion.button
                      whileHover={{ scale: 1.05 }}
                      whileTap={{ scale: 0.95 }}
                      onClick={handleSave}
                      disabled={saving || loadingInitial || !name || (!isEdit && !customerId)}
                      className="group px-5 py-2.5 bg-gradient-to-r from-blue-600 to-purple-600 text-white rounded-xl hover:shadow-xl transition-all duration-200 shadow-lg disabled:opacity-50 flex items-center gap-2"
                    >
                      {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                      <span className="font-medium">
                        {saving ? 'Saving…' : 'Save pipeline'}
                      </span>
                    </motion.button>

                    <div className="w-px h-8 bg-gradient-to-b from-transparent via-gray-300 to-transparent mx-1" />

                    <motion.button
                      whileHover={{ scale: 1.1, rotate: 90 }}
                      whileTap={{ scale: 0.9 }}
                      onClick={onClose}
                      className="p-2.5 bg-white/80 backdrop-blur-xl border border-gray-200 rounded-xl hover:bg-gray-50 transition-all duration-200 shadow-lg hover:shadow-xl"
                    >
                      <X className="h-5 w-5 text-gray-600" />
                    </motion.button>
                  </div>
                </div>

                {/* Validation status row */}
                <div className="flex items-center gap-3 flex-wrap">
                  {validationOk === true && (
                    <div className="px-3 py-1.5 rounded-full text-xs font-semibold flex items-center gap-1.5 bg-green-100 text-green-700">
                      <CheckCircle2 className="h-3.5 w-3.5" />
                      Pipeline is valid
                    </div>
                  )}
                  {validationOk === false && (
                    <div className="px-3 py-1.5 rounded-full text-xs font-semibold flex items-center gap-1.5 bg-red-100 text-red-700">
                      <AlertTriangle className="h-3.5 w-3.5" />
                      {validationErrors.length} issue{validationErrors.length === 1 ? '' : 's'}
                    </div>
                  )}
                  <span className="text-xs text-gray-500">
                    {stages.length} stage{stages.length === 1 ? '' : 's'} · type: {type} · trigger: {triggerType}
                  </span>
                </div>
              </div>
            </div>

            {/* Body */}
            <div className="flex-1 overflow-y-auto relative">
              <div className="absolute inset-0 opacity-[0.015]">
                <div className="absolute inset-0" style={{
                  backgroundImage: 'radial-gradient(circle at 2px 2px, rgb(99, 102, 241) 1px, transparent 1px)',
                  backgroundSize: '32px 32px',
                }} />
              </div>

              <div className="relative px-8 py-8 pb-24 space-y-6">
                {err && (
                  <div className="p-4 bg-red-50 border border-red-200 rounded-xl text-sm text-red-700">{err}</div>
                )}

                {loadingInitial ? (
                  <div className="flex items-center justify-center py-16">
                    <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
                  </div>
                ) : (
                  <>
                    {/* Top-level config */}
                    <div className="bg-white/70 backdrop-blur-sm rounded-2xl border border-white/40 shadow-sm p-6">
                      <h3 className="text-sm font-semibold text-gray-700 mb-4 flex items-center gap-2">
                        <Settings className="h-4 w-4 text-blue-600" /> Pipeline configuration
                      </h3>
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div>
                          <label className="block text-xs font-medium text-gray-700 mb-1.5">
                            Customer <span className="text-red-600">*</span>
                          </label>
                          <FancySelect
                            value={customerId}
                            onChange={(v) => setCustomerId(v)}
                          >
                            <option value="">Select a customer…</option>
                            {customerList.map((c) => (
                              <option key={c.id} value={c.id}>
                                {c.name ? `${c.name} · ${c.id}` : c.id}
                              </option>
                            ))}
                          </FancySelect>
                          {customerList.length === 0 && !loadingCustomers && (
                            <div className="text-[11px] text-amber-600 mt-1.5 italic">No customers found — create one in Build admin → Customers first.</div>
                          )}
                          {isEdit && <div className="text-[11px] text-gray-400 mt-1.5 italic">Can't change after create</div>}
                        </div>
                        <div>
                          <label className="block text-xs font-medium text-gray-700 mb-1.5">
                            Name <span className="text-red-600">*</span>
                          </label>
                          <input
                            className={INPUT_CLS}
                            placeholder="my-deploy-pipeline"
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-medium text-gray-700 mb-1.5">Trigger</label>
                          <FancySelect
                            value={triggerType}
                            onChange={(v) => setTriggerType(v as any)}
                          >
                            <option value="manual">manual</option>
                            <option value="cron">cron</option>
                            <option value="webhook">webhook</option>
                          </FancySelect>
                        </div>
                      </div>
                    </div>

                    {/* Section 1 — Pipeline type */}
                    <div className="bg-white/70 backdrop-blur-sm rounded-2xl border border-white/40 shadow-sm p-6">
                      <h3 className="text-sm font-semibold text-gray-700 mb-1 flex items-center gap-2">
                        <Workflow className="h-4 w-4 text-blue-600" /> Pipeline type
                      </h3>
                      <p className="text-xs text-gray-500 mb-4">
                        Picks the recipe of stages below. You can still toggle individual stages on/off and edit their inputs.
                      </p>
                      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                        {PIPELINE_TYPES.map((t) => {
                          const active = type === t.id;
                          const Icon = t.icon;
                          return (
                            <button
                              key={t.id}
                              onClick={() => handleTypeChange(t.id)}
                              className={`relative text-left rounded-xl p-4 border transition-all duration-200 group ${
                                active
                                  ? 'bg-gradient-to-br from-blue-50 via-purple-50 to-pink-50 border-blue-300 shadow-md'
                                  : 'bg-white hover:bg-blue-50/40 border-gray-200 hover:border-blue-200 shadow-sm hover:shadow-md'
                              }`}
                            >
                              {active && (
                                <span className="absolute top-2 right-2 w-5 h-5 rounded-full bg-gradient-to-r from-blue-500 to-purple-500 text-white flex items-center justify-center shadow-sm">
                                  <Check className="h-3 w-3" />
                                </span>
                              )}
                              <div className="flex items-center gap-2 mb-1.5">
                                <Icon className={`h-4 w-4 ${active ? 'text-blue-700' : 'text-gray-500'}`} />
                                <span
                                  className={
                                    active
                                      ? 'text-sm font-semibold bg-gradient-to-r from-blue-600 via-purple-600 to-pink-600 bg-clip-text text-transparent'
                                      : 'text-sm font-semibold text-gray-800 group-hover:text-blue-700'
                                  }
                                >
                                  {t.name}
                                </span>
                              </div>
                              <div className="text-[11px] text-gray-500 leading-relaxed">{t.description}</div>
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    {/* Section 2 — Source */}
                    <div className="bg-white/70 backdrop-blur-sm rounded-2xl border border-white/40 shadow-sm p-6">
                      <h3 className="text-sm font-semibold text-gray-700 mb-4 flex items-center gap-2">
                        <GitBranch className="h-4 w-4 text-blue-600" /> Source
                      </h3>

                      {/* Pill toggle — Applications-style gradient active state */}
                      <div className="flex items-center gap-2 mb-4 flex-wrap">
                        <button
                          onClick={() => setSourceType('git')}
                          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium transition-all duration-200 ${
                            sourceType === 'git'
                              ? 'bg-gradient-to-r from-blue-500 to-purple-500 text-white shadow-lg'
                              : 'bg-white/60 border border-gray-200 hover:bg-gray-50 text-gray-700'
                          }`}
                        >
                          <GitBranch className="h-4 w-4" /> Git repository
                        </button>
                        <button
                          onClick={() => setSourceType('zip')}
                          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium transition-all duration-200 ${
                            sourceType === 'zip'
                              ? 'bg-gradient-to-r from-blue-500 to-purple-500 text-white shadow-lg'
                              : 'bg-white/60 border border-gray-200 hover:bg-gray-50 text-gray-700'
                          }`}
                        >
                          <Upload className="h-4 w-4" /> Zip upload
                        </button>
                      </div>

                      {sourceType === 'git' ? (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <div className="md:col-span-2">
                            <label className="block text-xs font-medium text-gray-700 mb-1.5">
                              Repository URL <span className="text-red-600">*</span>
                            </label>
                            <input
                              className={`${INPUT_CLS} font-mono`}
                              placeholder="https://github.com/acme/web.git"
                              value={gitUrl}
                              onChange={(e) => setGitUrl(e.target.value)}
                            />
                          </div>
                          <div>
                            <label className="block text-xs font-medium text-gray-700 mb-1.5">Branch / ref</label>
                            <input
                              className={`${INPUT_CLS} font-mono`}
                              placeholder="main"
                              value={gitRef}
                              onChange={(e) => setGitRef(e.target.value)}
                            />
                          </div>
                          <div>
                            <label className="block text-xs font-medium text-gray-700 mb-1.5">Depth</label>
                            <input
                              type="number"
                              className={INPUT_CLS}
                              placeholder="1"
                              value={gitDepth}
                              min={1}
                              onChange={(e) => setGitDepth(Math.max(1, parseInt(e.target.value || '1', 10)))}
                            />
                          </div>
                          <div className="md:col-span-2">
                            <label className="block text-xs font-medium text-gray-700 mb-1.5">Access token</label>
                            <div className="relative">
                              <input
                                type={showGitToken ? 'text' : 'password'}
                                className={`${INPUT_CLS} font-mono pr-10`}
                                placeholder="(optional — for private repos)"
                                value={gitToken}
                                onChange={(e) => setGitToken(e.target.value)}
                                autoComplete="off"
                              />
                              <button
                                type="button"
                                onClick={() => setShowGitToken((v) => !v)}
                                className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 text-gray-400 hover:text-gray-600 rounded-md hover:bg-gray-100 transition-colors"
                                title={showGitToken ? 'Hide token' : 'Show token'}
                              >
                                {showGitToken ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                              </button>
                            </div>
                            <div className="text-[11px] text-gray-500 mt-1.5 italic">
                              Optional — only needed for private repos. Stored encrypted.
                            </div>
                          </div>
                        </div>
                      ) : (
                        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 flex items-start gap-3">
                          <Info className="h-5 w-5 text-amber-600 flex-shrink-0 mt-0.5" />
                          <div className="text-sm text-amber-900">
                            <div className="font-semibold mb-0.5">Zip upload source</div>
                            <div className="text-xs text-amber-800">
                              Upload a zip when you trigger a build. No pipeline-level config needed.
                            </div>
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Section 3 — Stages (linear) */}
                    <div className="bg-white/70 backdrop-blur-sm rounded-2xl border border-white/40 shadow-sm p-6">
                      <div className="flex items-center justify-between mb-4">
                        <h3 className="text-sm font-semibold text-gray-700 flex items-center gap-2">
                          <Workflow className="h-4 w-4 text-blue-600" />
                          Stages <span className="text-gray-400 font-normal">({stages.length})</span>
                        </h3>
                        <motion.button
                          whileHover={{ scale: 1.05 }}
                          whileTap={{ scale: 0.95 }}
                          onClick={addStage}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-gradient-to-r from-blue-600 to-purple-600 text-white rounded-lg shadow-sm hover:shadow-md transition-all duration-200"
                        >
                          <Plus className="h-3.5 w-3.5" /> Add stage
                        </motion.button>
                      </div>

                      <p className="text-[11px] text-gray-500 mb-4 italic">
                        Stages run in order, top to bottom. Drag the arrows to reorder or toggle a stage off to skip it.
                      </p>

                      {stages.length === 0 ? (
                        <div className="text-center py-10 text-sm text-gray-500">
                          {type === 'custom'
                            ? 'No stages yet. Click "Add stage" to build from scratch, or pick a different pipeline type above to load a recipe.'
                            : 'No stages in this recipe. Pick a different type above.'}
                        </div>
                      ) : (
                        <div className="space-y-3">
                          {stages.map((stage, idx) => {
                            const actionDef = stage.action ? actionById.get(stage.action) : undefined;
                            const props = schemaProps(actionDef?.inputs);
                            const stageErrors = errorsByStage.get(idx) || [];
                            const hasErr = stageErrors.length > 0;
                            const disabled = stage.enabled === false;
                            const showActionPicker = actionPickerOpen[idx] || !stage.action;

                            const scalarProps = props.filter(([, s]) => !isWideField(s));
                            const wideProps = props.filter(([, s]) => isWideField(s));

                            return (
                              <div
                                key={idx}
                                className={`rounded-xl border shadow-sm hover:shadow-md transition-all duration-200 ${
                                  hasErr
                                    ? 'bg-red-50/70 border-red-200'
                                    : disabled
                                      ? 'bg-gray-50 border-gray-200 opacity-60'
                                      : 'bg-white border-gray-200'
                                }`}
                              >
                                {/* Header */}
                                <div className="px-5 py-3 border-b border-gray-100 flex items-center justify-between gap-3">
                                  <div className="flex items-center gap-3 min-w-0 flex-1">
                                    <span className="w-7 h-7 rounded-lg bg-gradient-to-r from-blue-500 to-purple-500 text-white font-semibold text-xs flex items-center justify-center flex-shrink-0 shadow-sm">
                                      {idx + 1}
                                    </span>
                                    <input
                                      className="flex-1 min-w-0 px-2 py-1 bg-transparent border-b border-transparent hover:border-gray-200 focus:border-blue-300 focus:outline-none text-sm font-medium text-gray-800 transition-all"
                                      placeholder="Stage name"
                                      value={stage.name || ''}
                                      onChange={(e) => {
                                        const n = e.target.value;
                                        // Auto-derive id from name — stable slug used
                                        // to build the linear needs chain at save time.
                                        const slug = n.toLowerCase()
                                          .replace(/[^a-z0-9]+/g, '-')
                                          .replace(/^-+|-+$/g, '')
                                          .slice(0, 40) || `stage-${idx + 1}`;
                                        updateStage(idx, { name: n, id: slug });
                                      }}
                                    />
                                    {disabled && (
                                      <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-gray-200 text-gray-600 flex-shrink-0">
                                        Disabled
                                      </span>
                                    )}
                                    {hasErr && (
                                      <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-red-100 text-red-700 flex-shrink-0">
                                        {stageErrors.length} issue{stageErrors.length === 1 ? '' : 's'}
                                      </span>
                                    )}
                                  </div>
                                  <div className="flex items-center gap-1 flex-shrink-0">
                                    {/* Enable toggle */}
                                    <label
                                      className="relative inline-flex items-center cursor-pointer mr-1"
                                      title={disabled ? 'Stage disabled — will be skipped at build time' : 'Stage enabled'}
                                    >
                                      <input
                                        type="checkbox"
                                        className="sr-only peer"
                                        checked={!disabled}
                                        onChange={(e) => updateStage(idx, { enabled: e.target.checked })}
                                      />
                                      <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600" />
                                    </label>
                                    <button
                                      disabled={idx === 0}
                                      onClick={() => moveStage(idx, -1)}
                                      className="p-1.5 text-gray-500 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-all duration-200 disabled:opacity-30 disabled:hover:bg-transparent"
                                      title="Move up"
                                    >
                                      <ArrowUp className="h-3.5 w-3.5" />
                                    </button>
                                    <button
                                      disabled={idx === stages.length - 1}
                                      onClick={() => moveStage(idx, 1)}
                                      className="p-1.5 text-gray-500 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-all duration-200 disabled:opacity-30 disabled:hover:bg-transparent"
                                      title="Move down"
                                    >
                                      <ArrowDown className="h-3.5 w-3.5" />
                                    </button>
                                    <button
                                      onClick={() => removeStage(idx)}
                                      className="p-1.5 text-gray-500 hover:text-red-600 hover:bg-red-50 rounded-lg transition-all duration-200"
                                      title="Remove stage"
                                    >
                                      <Trash2 className="h-3.5 w-3.5" />
                                    </button>
                                  </div>
                                </div>

                                {/* Body */}
                                <div className="p-5 space-y-4">
                                  {hasErr && (
                                    <div className="bg-red-50 border border-red-200 rounded-xl p-3 text-xs text-red-700 space-y-1">
                                      {stageErrors.map((e, i) => (
                                        <div key={i}>
                                          <code className="bg-red-100 px-1.5 py-0.5 rounded font-mono text-[11px]">{e.path || '(root)'}</code>
                                          <span className="ml-1">— {e.message}</span>
                                        </div>
                                      ))}
                                    </div>
                                  )}

                                  {/* Action summary chip (read-only) + Change link
                                      OR dropdown if picker is open. */}
                                  {showActionPicker ? (
                                    <div>
                                      <label className="block text-sm font-medium text-gray-700 mb-2">
                                        Action <span className="text-red-600">*</span>
                                      </label>
                                      <FancySelect
                                        value={stage.action}
                                        onChange={(v) => {
                                          updateStage(idx, { action: v, with: {} });
                                          setActionPickerOpen((m) => ({ ...m, [idx]: false }));
                                        }}
                                      >
                                        <option value="">(choose action)</option>
                                        {Object.keys(actionsByCategory).sort().map((cat) => (
                                          <optgroup key={cat} label={cat}>
                                            {actionsByCategory[cat].map((a) => (
                                              <option key={a.id} value={a.id}>{a.id} — {a.name}</option>
                                            ))}
                                          </optgroup>
                                        ))}
                                      </FancySelect>
                                      {actionDef?.description && (
                                        <div className="text-[11px] text-gray-500 mt-1.5 italic">{actionDef.description}</div>
                                      )}
                                    </div>
                                  ) : (
                                    <div className="flex items-center gap-2 text-xs">
                                      <span className="text-gray-500">Action:</span>
                                      <code className="bg-gradient-to-r from-blue-500/10 to-purple-500/10 text-blue-700 px-2 py-1 rounded font-mono">
                                        {stage.action}
                                      </code>
                                      {actionDef?.name && (
                                        <span className="text-gray-600">— {actionDef.name}</span>
                                      )}
                                    </div>
                                  )}

                                  {/* Input grid */}
                                  {actionDef && (scalarProps.length > 0 || wideProps.length > 0) && (
                                    <div className="border-t border-gray-100 pt-4">
                                      <div className="text-xs font-semibold text-gray-700 mb-3 flex items-center gap-1.5">
                                        <span className="w-1.5 h-1.5 rounded-full bg-blue-500" /> Inputs
                                      </div>
                                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                        {scalarProps.map(([k, s, req]) => (
                                          <div key={k}>
                                            <InputField
                                              name={k}
                                              schema={s}
                                              required={req}
                                              value={stage.with?.[k]}
                                              onChange={(v) => {
                                                const next = { ...(stage.with || {}) };
                                                if (v === undefined) delete next[k]; else next[k] = v;
                                                updateStage(idx, { with: next });
                                              }}
                                            />
                                          </div>
                                        ))}
                                        {wideProps.map(([k, s, req]) => (
                                          <div key={k} className="md:col-span-2">
                                            <InputField
                                              name={k}
                                              schema={s}
                                              required={req}
                                              value={stage.with?.[k]}
                                              onChange={(v) => {
                                                const next = { ...(stage.with || {}) };
                                                if (v === undefined) delete next[k]; else next[k] = v;
                                                updateStage(idx, { with: next });
                                              }}
                                            />
                                          </div>
                                        ))}
                                      </div>
                                    </div>
                                  )}

                                  {actionDef && props.length === 0 && (
                                    <div className="text-[11px] text-gray-500 italic">
                                      This action has no declared inputs.
                                    </div>
                                  )}

                                  {/* Change action link — slim, at bottom of inputs grid */}
                                  {!showActionPicker && stage.action && (
                                    <div className="text-right">
                                      <button
                                        onClick={() => setActionPickerOpen((m) => ({ ...m, [idx]: true }))}
                                        className="text-[11px] text-blue-600 hover:underline"
                                      >
                                        Change action
                                      </button>
                                    </div>
                                  )}

                                  {/* Advanced */}
                                  <details className="border-t border-gray-100 pt-3 group">
                                    <summary className="text-xs font-medium text-gray-600 cursor-pointer flex items-center gap-1.5 hover:text-gray-900">
                                      <Sliders className="h-3.5 w-3.5" /> Advanced
                                    </summary>
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-3">
                                      <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-2">
                                          Continue on error
                                        </label>
                                        <Switch
                                          checked={Boolean(stage.continueOnError)}
                                          onChange={(v) => updateStage(idx, { continueOnError: v })}
                                          labelOn="Continue"
                                          labelOff="Stop on fail"
                                        />
                                      </div>
                                      <div>
                                        <label className="block text-xs font-medium text-gray-700 mb-1.5">
                                          <code className="bg-gray-100 px-1.5 py-0.5 rounded">timeoutSec</code>
                                        </label>
                                        <input
                                          type="number"
                                          className={INPUT_CLS}
                                          value={stage.timeoutSec ?? ''}
                                          onChange={(e) => {
                                            const v = e.target.value;
                                            updateStage(idx, { timeoutSec: v === '' ? null : parseInt(v, 10) });
                                          }}
                                        />
                                      </div>
                                      <div className="md:col-span-2">
                                        <label className="block text-xs font-medium text-gray-700 mb-1.5">
                                          <code className="bg-gray-100 px-1.5 py-0.5 rounded">actionVersion</code>
                                        </label>
                                        <input
                                          className={`${INPUT_CLS} font-mono`}
                                          placeholder={actionDef?.version ?? 'latest'}
                                          value={stage.actionVersion ?? ''}
                                          onChange={(e) => updateStage(idx, { actionVersion: e.target.value || undefined })}
                                        />
                                      </div>
                                    </div>
                                  </details>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  </>
                )}
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
