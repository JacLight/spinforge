/**
 * Shared build/hosting/features policy editor.
 *
 * Used by:
 *   - Customer drawer (admin) Policy tab
 *   - Legacy /build/customers (being retired)
 */
import React, { useState } from 'react';
import { Save, RotateCcw } from 'lucide-react';
import { buildApi, Policy, DEFAULT_POLICY, friendlyError } from '../../services/buildApi';
import { toast } from 'sonner';

const ALL_PLATFORMS = ['web', 'linux', 'android', 'ios', 'macos', 'flutter', 'electron'];
const ALL_RUNNER_CLASSES = ['nomad-docker', 'lxc', 'macos'];

export function PolicyEditor({
  customerId,
  initialPolicy,
  onSaved,
}: {
  customerId: string;
  initialPolicy: Policy;
  onSaved?: () => void;
}) {
  const [policy, setPolicy] = useState<Policy>(JSON.parse(JSON.stringify(initialPolicy || DEFAULT_POLICY)));
  const [tab, setTab] = useState<'form' | 'json'>('form');
  const [rawJson, setRawJson] = useState(JSON.stringify(initialPolicy || DEFAULT_POLICY, null, 2));
  const [jsonErr, setJsonErr] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  function setBuild<K extends keyof Policy['build']>(k: K, v: Policy['build'][K]) {
    setPolicy((p) => ({ ...p, build: { ...p.build, [k]: v } }));
  }
  function setHosting<K extends keyof Policy['hosting']>(k: K, v: Policy['hosting'][K]) {
    setPolicy((p) => ({ ...p, hosting: { ...p.hosting, [k]: v } }));
  }
  function setFeatures<K extends keyof Policy['features']>(k: K, v: Policy['features'][K]) {
    setPolicy((p) => ({ ...p, features: { ...p.features, [k]: v } }));
  }

  function togglePlatform(p: string) {
    const cur = policy.build.allowedPlatforms || [];
    setBuild('allowedPlatforms', cur.includes(p) ? cur.filter((x) => x !== p) : [...cur, p]);
  }
  function toggleRunnerClass(c: string) {
    const cur = policy.build.allowedRunnerClasses || [];
    setBuild('allowedRunnerClasses', cur.includes(c) ? cur.filter((x) => x !== c) : [...cur, c]);
  }

  function handleReset() {
    setPolicy(JSON.parse(JSON.stringify(initialPolicy || DEFAULT_POLICY)));
    setRawJson(JSON.stringify(initialPolicy || DEFAULT_POLICY, null, 2));
    setJsonErr(null);
  }

  async function handleSave() {
    let next = policy;
    if (tab === 'json') {
      try {
        next = JSON.parse(rawJson);
        setJsonErr(null);
      } catch (e: any) {
        setJsonErr('Invalid JSON: ' + e.message);
        return;
      }
    }
    setSaving(true);
    try {
      await buildApi.putPolicy(customerId, next);
      setPolicy(next);
      setRawJson(JSON.stringify(next, null, 2));
      toast.success('Policy saved');
      onSaved?.();
    } catch (e: any) {
      toast.error(friendlyError(e));
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="bg-white border border-gray-200 rounded-2xl shadow-sm">
      <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
        <h3 className="font-semibold text-sm text-gray-900">
          Policy · <span className="font-mono text-indigo-600">{customerId}</span>
        </h3>
        <div className="inline-flex bg-gray-100 rounded-lg p-0.5">
          <button
            onClick={() => setTab('form')}
            className={`px-3 py-1 text-xs rounded-md font-medium transition-colors ${
              tab === 'form' ? 'bg-white shadow-sm text-gray-900' : 'text-gray-600 hover:text-gray-900'
            }`}
          >Form</button>
          <button
            onClick={() => setTab('json')}
            className={`px-3 py-1 text-xs rounded-md font-medium transition-colors ${
              tab === 'json' ? 'bg-white shadow-sm text-gray-900' : 'text-gray-600 hover:text-gray-900'
            }`}
          >Raw JSON</button>
        </div>
      </div>

      <div className="p-5 space-y-5">
        {tab === 'form' ? (
          <>
            <Section title="Build">
              <Grid>
                <Num label="Concurrent jobs"         value={policy.build.concurrentJobs}       onChange={(v) => setBuild('concurrentJobs', v)} />
                <Num label="Max job duration (min)"  value={policy.build.maxJobDurationMin}    onChange={(v) => setBuild('maxJobDurationMin', v)} />
                <Num label="Max job CPU (MHz)"       value={policy.build.maxJobCpuMhz}         onChange={(v) => setBuild('maxJobCpuMhz', v)} />
                <Num label="Max job memory (MB)"     value={policy.build.maxJobMemoryMB}       onChange={(v) => setBuild('maxJobMemoryMB', v)} />
                <Num label="Max artifact (MB)"       value={policy.build.maxArtifactMB}        onChange={(v) => setBuild('maxArtifactMB', v)} />
                <Num label="Monthly CPU seconds"     value={policy.build.monthlyCpuSeconds}    onChange={(v) => setBuild('monthlyCpuSeconds', v)} />
                <Num label="Monthly build minutes"   value={policy.build.monthlyBuildMinutes}  onChange={(v) => setBuild('monthlyBuildMinutes', v)} />
              </Grid>
              <div className="mt-4">
                <div className="text-xs font-medium text-gray-600 mb-1.5">Allowed platforms</div>
                <div className="flex flex-wrap gap-1.5">
                  {ALL_PLATFORMS.map((p) => (
                    <button
                      key={p}
                      onClick={() => togglePlatform(p)}
                      className={`px-2.5 py-1 text-xs rounded-full border font-medium transition-colors ${
                        (policy.build.allowedPlatforms || []).includes(p)
                          ? 'bg-indigo-600 text-white border-indigo-600'
                          : 'bg-white text-gray-700 border-gray-200 hover:bg-gray-50'
                      }`}
                    >{p}</button>
                  ))}
                </div>
              </div>
              <div className="mt-4">
                <div className="text-xs font-medium text-gray-600 mb-1.5">Allowed runner classes</div>
                <div className="flex flex-wrap gap-1.5">
                  {ALL_RUNNER_CLASSES.map((c) => (
                    <button
                      key={c}
                      onClick={() => toggleRunnerClass(c)}
                      className={`px-2.5 py-1 text-xs rounded-full border font-medium transition-colors ${
                        (policy.build.allowedRunnerClasses || []).includes(c)
                          ? 'bg-indigo-600 text-white border-indigo-600'
                          : 'bg-white text-gray-700 border-gray-200 hover:bg-gray-50'
                      }`}
                    >{c}</button>
                  ))}
                </div>
              </div>
            </Section>

            <Section title="Hosting">
              <Grid>
                <Num label="Max sites"                 value={policy.hosting.maxSites}              onChange={(v) => setHosting('maxSites', v)} />
                <Num label="Max custom domains"        value={policy.hosting.maxCustomDomains}      onChange={(v) => setHosting('maxCustomDomains', v)} />
                <Num label="Max SSL certs"             value={policy.hosting.maxSslCerts}           onChange={(v) => setHosting('maxSslCerts', v)} />
                <Num label="Max signing profiles"      value={policy.hosting.maxSigningProfiles}    onChange={(v) => setHosting('maxSigningProfiles', v)} />
                <Num label="Concurrent containers"     value={policy.hosting.concurrentContainers}  onChange={(v) => setHosting('concurrentContainers', v)} />
                <Num label="Max container memory (MB)" value={policy.hosting.maxContainerMemoryMB} onChange={(v) => setHosting('maxContainerMemoryMB', v)} />
                <Num label="Max container CPU (MHz)"   value={policy.hosting.maxContainerCpuMhz}   onChange={(v) => setHosting('maxContainerCpuMhz', v)} />
                <Num label="Max static storage (GB)"   value={policy.hosting.maxStaticStorageGB}   onChange={(v) => setHosting('maxStaticStorageGB', v)} />
                <Num label="Monthly egress (GB)"       value={policy.hosting.monthlyEgressGB}      onChange={(v) => setHosting('monthlyEgressGB', v)} />
                <Num label="Monthly requests"          value={policy.hosting.monthlyRequestCount}  onChange={(v) => setHosting('monthlyRequestCount', v)} />
                <Num label="Requests per second"       value={policy.hosting.requestsPerSecond}    onChange={(v) => setHosting('requestsPerSecond', v)} />
              </Grid>
            </Section>

            <Section title="Features">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <Bool label="Signing profiles" value={policy.features.signingProfiles} onChange={(v) => setFeatures('signingProfiles', v)} />
                <Bool label="Custom domains"   value={policy.features.customDomains}   onChange={(v) => setFeatures('customDomains', v)} />
                <Bool label="Mac builds"       value={policy.features.macBuilds}       onChange={(v) => setFeatures('macBuilds', v)} />
              </div>
            </Section>
          </>
        ) : (
          <>
            <textarea
              className="w-full h-96 p-3 font-mono text-xs border border-gray-200 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
              value={rawJson}
              onChange={(e) => setRawJson(e.target.value)}
              spellCheck={false}
            />
            {jsonErr && <div className="p-2 bg-red-50 border border-red-200 rounded text-xs text-red-700">{jsonErr}</div>}
          </>
        )}

        <div className="flex items-center justify-end gap-2 pt-3 border-t border-gray-100">
          <button
            onClick={handleReset}
            className="inline-flex items-center gap-1 px-3 py-1.5 text-sm border border-gray-200 rounded-lg hover:bg-gray-50 font-medium"
          >
            <RotateCcw size={12} /> Reset
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="inline-flex items-center gap-1 px-4 py-1.5 text-sm bg-gradient-to-r from-blue-600 to-purple-600 text-white rounded-lg hover:shadow-lg disabled:opacity-50 font-medium"
          >
            <Save size={12} /> {saving ? 'Saving…' : 'Save policy'}
          </button>
        </div>
      </div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <h4 className="text-xs font-semibold text-gray-600 uppercase tracking-wider mb-2">{title}</h4>
      {children}
    </div>
  );
}

function Grid({ children }: { children: React.ReactNode }) {
  return <div className="grid grid-cols-2 md:grid-cols-3 gap-3">{children}</div>;
}

function Num({ label, value, onChange }: { label: string; value: number; onChange: (v: number) => void }) {
  return (
    <label className="block">
      <span className="block text-xs text-gray-500 mb-1">{label}</span>
      <input
        type="number"
        className="w-full px-2.5 py-1.5 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
        value={value ?? 0}
        onChange={(e) => onChange(Number(e.target.value))}
      />
    </label>
  );
}

function Bool({ label, value, onChange }: { label: string; value: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="inline-flex items-center gap-2 text-sm text-gray-700">
      <input
        type="checkbox"
        checked={!!value}
        onChange={(e) => onChange(e.target.checked)}
        className="h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
      />
      {label}
    </label>
  );
}
