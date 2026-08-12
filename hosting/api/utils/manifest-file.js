/**
 * Render an app's spinforge.yaml / spinforge.json.
 *
 * Shared by the customer route (/_api/customer/sites/:domain/manifest) and
 * the admin route (/api/sites/:domain/manifest) so the two can never drift
 * — a customer and an operator looking at the same app must see the same
 * file, byte for byte.
 *
 * Returns { status, contentType, filename, body } and never throws for
 * ordinary "can't build this" cases; the caller just sends it.
 */

function renderManifest(site, { format = 'yaml', repoUrl } = {}) {
  if (!site || !site.appId) {
    return {
      status: 409,
      contentType: 'application/json',
      filename: null,
      body: JSON.stringify({
        error: 'This app predates manifest support and has no appId. Re-save it from the dashboard to assign one.',
      }),
    };
  }

  const repo = repoUrl || 'https://github.com/you/your-repo';
  const fmt = String(format).toLowerCase() === 'json' ? 'json' : 'yaml';

  if (fmt === 'json') {
    return {
      status: 200,
      contentType: 'application/json',
      filename: 'spinforge.json',
      body: JSON.stringify({
        $schema: 'https://build.spinforge.dev/_api/customer/manifest/schema',
        appId: site.appId,
        repo: { url: repo },
      }, null, 2) + '\n',
    };
  }

  const yaml = [
    '# SpinForge deployment manifest',
    `# App:    ${site.domain}`,
    `# Type:   ${site.type}`,
    '#',
    '# Commit this file to your repository root, then on every push run:',
    '#   curl -X POST https://build.spinforge.dev/_api/customer/manifest \\',
    '#        -H "Authorization: Bearer $SPINFORGE_TOKEN" \\',
    '#        -H "Content-Type: application/yaml" \\',
    '#        --data-binary @spinforge.yaml',
    '#',
    '# appId is stable — changing this app\'s domain will not invalidate it.',
    '',
    `appId: ${site.appId}`,
    '',
    'repo:',
    `  url: ${repo}`,
    '  # ref: main          # default: the repository default branch',
    '',
    '# rootDir: apps/web    # subdirectory holding this project, for monorepos',
    '# autoDeploy: true     # false = save configuration without building',
    '',
  ].join('\n');

  return {
    status: 200,
    contentType: 'application/yaml',
    filename: 'spinforge.yaml',
    body: yaml,
  };
}

module.exports = { renderManifest };
