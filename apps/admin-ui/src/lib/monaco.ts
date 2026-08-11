/**
 * SpinForge - Monaco bootstrap.
 *
 * `@monaco-editor/react` fetches Monaco from a public CDN by default. The
 * admin UI runs on a private network behind the edge, so that request just
 * hangs and the editor never appears. Point the loader at the copy Vite
 * bundles from node_modules instead — larger build, but it works offline
 * and on an air-gapped install.
 *
 * Import this module once, for its side effects, before rendering an editor.
 */

import * as monaco from 'monaco-editor';
import { loader } from '@monaco-editor/react';

// monaco-editor 0.56 ships an `exports` map of `"./*.js": "./esm/vs/*.js"`,
// so subpaths are relative to esm/vs — the older
// `monaco-editor/esm/vs/editor/editor.worker` form no longer resolves.
import editorWorker from 'monaco-editor/editor/editor.worker.js?worker';
import htmlWorker from 'monaco-editor/language/html/html.worker.js?worker';
import jsonWorker from 'monaco-editor/language/json/json.worker.js?worker';
import cssWorker from 'monaco-editor/language/css/css.worker.js?worker';
import tsWorker from 'monaco-editor/language/typescript/ts.worker.js?worker';

// Monaco asks for a worker per language. Without this it falls back to
// running language services on the main thread and logs a warning on
// every keystroke.
(self as any).MonacoEnvironment = {
  getWorker(_workerId: string, label: string) {
    switch (label) {
      case 'html':
      case 'handlebars':
      case 'razor':
        return new htmlWorker();
      case 'json':
        return new jsonWorker();
      case 'css':
      case 'scss':
      case 'less':
        return new cssWorker();
      case 'typescript':
      case 'javascript':
        return new tsWorker();
      default:
        return new editorWorker();
    }
  },
};

loader.config({ monaco });

export { monaco };
