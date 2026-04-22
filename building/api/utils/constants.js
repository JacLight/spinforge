const path = require('path');

const DATA_ROOT = process.env.DATA_ROOT || '/data';

// All SpinBuild data subtrees live under the Ceph-backed DATA_ROOT so every
// node sees the same files without coordination.
module.exports = {
  DATA_ROOT,
  WORKSPACES_ROOT: path.join(DATA_ROOT, 'workspaces'),
  ARTIFACTS_ROOT: path.join(DATA_ROOT, 'artifacts'),
  UPLOADS_TMP: path.join(DATA_ROOT, 'uploads', 'tmp'),

  // Upload hard cap. Workspace zips larger than this should use a pre-signed
  // URL flow instead of direct upload; we'll add that path once needed.
  MAX_UPLOAD_BYTES: 500 * 1024 * 1024,

  // Known platform values. Kept in sync with PLATFORM_PLAN.md §2.
  PLATFORMS: new Set([
    'web',
    'ios',
    'android',
    'macos',
    'flutter',
    'electron',
    'linux',
    'windows',
  ]),
};
