/**
 * SpinForge - Monaco-backed code editor.
 *
 * Deliberately a separate module with a default export so callers can pull
 * it in with `React.lazy(() => import('./CodeEditor'))`. Monaco is ~3 MB;
 * importing it statically would add that to the main bundle for every admin
 * page, including the ones that never show an editor.
 */

import Editor from '@monaco-editor/react';
// Side effect: points Monaco's loader at the bundled copy rather than the
// CDN, which isn't reachable from this network.
import '../lib/monaco';

interface CodeEditorProps {
  value: string;
  onChange: (value: string) => void;
  language?: string;
  height?: string;
  /** Extra Monaco options, merged over the defaults below. */
  options?: Record<string, unknown>;
}

const DEFAULT_OPTIONS = {
  minimap: { enabled: false },
  fontSize: 12,
  lineNumbers: 'on' as const,
  scrollBeyondLastLine: false,
  automaticLayout: true,
  tabSize: 2,
  wordWrap: 'on' as const,
  renderLineHighlight: 'line' as const,
  overviewRulerLanes: 0,
  padding: { top: 8, bottom: 8 },
};

export default function CodeEditor({
  value,
  onChange,
  language = 'html',
  height = '420px',
  options,
}: CodeEditorProps) {
  return (
    <Editor
      height={height}
      defaultLanguage={language}
      theme="vs-dark"
      value={value}
      onChange={(next) => onChange(next ?? '')}
      options={{ ...DEFAULT_OPTIONS, ...(options || {}) }}
      loading={<div className="p-4 text-xs text-gray-500">Loading editor…</div>}
    />
  );
}
