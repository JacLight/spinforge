/**
 * Seed action catalog. Each action declares: id, version, name,
 * description, category, inputs (JSON Schema), outputs (JSON Schema),
 * and a runner hint (how BuildService will execute it).
 *
 * Categories group the UI:
 *   source   — get code/assets into a workspace (zip, git, fetch)
 *   install  — fetch project dependencies (npm, cocoapods, gradle)
 *   test     — run project tests (npm, xcode, gradle)
 *   build    — produce an artifact from sources (node, static, docker, ios, android)
 *   package  — collect the build output into a distributable archive
 *   sign     — sign an artifact (ios, android, code-signing)
 *   publish  — push a signed artifact somewhere (appstore, playstore, registry)
 *   deploy   — make an artifact serve live traffic (static-site, container)
 *   host     — legacy alias family for deploy.*; kept registered via aliases
 *   util     — notifications, webhooks, delays
 *
 * Runner hints:
 *   { kind: 'inproc' }               — handler runs inside building-api process
 *                                      (cheap file/keydb shuffles)
 *   { kind: 'nomad', image }         — dispatched as a Nomad batch job, like
 *                                      today's build runners
 *   { kind: 'mac-runner' }           — forwarded to a registered macOS runner
 *                                      (ios / macos signing)
 *
 * Versioning: bump the version string when inputs/outputs change in a
 * backwards-incompatible way. Pipelines pin by `action: "id@version"` if
 * they want to; unversioned refs resolve to the newest registered.
 */

module.exports = [
  // ─── source ──────────────────────────────────────────────────────────
  {
    id: 'source.zip',
    version: '1.0',
    category: 'source',
    name: 'Unpack uploaded zip',
    description: 'Extract the pipeline\'s uploaded workspace.zip into the build workspace.',
    inputs: {
      type: 'object',
      additionalProperties: false,
      properties: {
        strip: { type: 'integer', minimum: 0, default: 0, description: 'Top-level directories to strip.' },
      },
    },
    outputs: {
      type: 'object',
      properties: {
        workspace: { type: 'string', description: 'Path to the extracted workspace root.' },
      },
      required: ['workspace'],
    },
    runner: { kind: 'inproc' },
  },
  {
    id: 'source.git',
    version: '1.0',
    category: 'source',
    name: 'Clone or pull a git repo',
    description: 'Clone (or fast-pull if cached) a git URL into the build workspace.',
    inputs: {
      type: 'object',
      additionalProperties: false,
      required: ['url'],
      properties: {
        url:   { type: 'string', format: 'uri' },
        ref:   { type: 'string', default: 'HEAD', description: 'Branch, tag, or SHA.' },
        depth: { type: 'integer', minimum: 1, default: 1 },
        token: { type: 'string', description: 'Optional PAT for private repos. Stored only in build env, not in the pipeline record.' },
      },
    },
    outputs: {
      type: 'object',
      properties: {
        workspace: { type: 'string' },
        commit:    { type: 'string' },
      },
      required: ['workspace', 'commit'],
    },
    runner: { kind: 'inproc' },
  },

  // ─── build ───────────────────────────────────────────────────────────
  {
    id: 'build.static',
    version: '1.0',
    category: 'build',
    name: 'Framework build (static)',
    description: 'Run a build command and collect the output directory as a static artifact.',
    inputs: {
      type: 'object',
      additionalProperties: false,
      required: ['command', 'outputDir'],
      properties: {
        command:   { type: 'string', default: 'npm ci && npm run build' },
        outputDir: { type: 'string', default: 'dist' },
        framework: { type: 'string', description: 'Hint only; no functional effect.' },
        env:       { type: 'object', additionalProperties: { type: 'string' } },
      },
    },
    outputs: {
      type: 'object',
      required: ['artifactPath'],
      properties: {
        artifactPath: { type: 'string', description: 'Path to the directory holding the built site.' },
        bytes:        { type: 'integer' },
      },
    },
    runner: { kind: 'nomad', image: 'spinforge/builder-linux' },
  },
  {
    id: 'build.container',
    version: '1.0',
    category: 'build',
    name: 'Docker image build',
    description: 'Build a Docker image from a Dockerfile and push to the cluster registry.',
    inputs: {
      type: 'object',
      additionalProperties: false,
      required: ['dockerfile'],
      properties: {
        dockerfile:  { type: 'string', default: 'Dockerfile' },
        context:     { type: 'string', default: '.' },
        imageName:   { type: 'string', description: 'If omitted, derived from customerId + pipelineId + buildId.' },
        buildArgs:   { type: 'object', additionalProperties: { type: 'string' } },
      },
    },
    outputs: {
      type: 'object',
      required: ['imageRef'],
      properties: {
        imageRef: { type: 'string', description: 'registry/repo:tag@sha256:…' },
      },
    },
    runner: { kind: 'nomad', image: 'spinforge/builder-linux' },
  },
  {
    id: 'build.node',
    version: '1.0',
    category: 'build',
    name: 'Build Node.js project',
    description: 'Install deps and run the npm/yarn build script. Collects a specified output as a zip artifact.',
    inputs: {
      type: 'object',
      additionalProperties: false,
      properties: {
        nodeVersion: { type: 'string', default: '20' },
        install:     { type: 'string', default: 'npm ci' },
        command:     { type: 'string', default: 'npm run build' },
        outputDir:   { type: 'string', default: 'dist' },
        env:         { type: 'object', additionalProperties: { type: 'string' } },
      },
    },
    outputs: {
      type: 'object',
      required: ['artifactZip'],
      properties: {
        artifactZip: { type: 'string' },
        bytes:       { type: 'integer' },
      },
    },
    runner: { kind: 'nomad', image: 'spinforge/builder-linux' },
  },
  {
    id: 'build.android',
    version: '1.0',
    category: 'build',
    name: 'Build Android (AAB or APK)',
    description: 'Assemble a release Android bundle or APK with Gradle.',
    inputs: {
      type: 'object',
      additionalProperties: false,
      properties: {
        task:       { type: 'string', default: 'bundleRelease', enum: ['bundleRelease', 'assembleRelease', 'bundleDebug', 'assembleDebug'] },
        gradleArgs: { type: 'array', items: { type: 'string' }, default: [] },
        env:        { type: 'object', additionalProperties: { type: 'string' } },
      },
    },
    outputs: {
      type: 'object',
      required: ['artifactPath'],
      properties: {
        artifactPath: { type: 'string' },
        format:       { type: 'string', enum: ['aab', 'apk'] },
      },
    },
    runner: { kind: 'nomad', image: 'spinforge/builder-android' },
  },
  {
    id: 'build.ios',
    version: '1.0',
    category: 'build',
    name: 'Build iOS (archive)',
    description: 'xcodebuild archive on a macOS runner. Outputs an .xcarchive ready for export.',
    inputs: {
      type: 'object',
      additionalProperties: false,
      required: ['scheme'],
      properties: {
        scheme:        { type: 'string' },
        configuration: { type: 'string', default: 'Release' },
        workspace:     { type: 'string', description: 'Path relative to workspace root; mutually exclusive with `project`.' },
        project:       { type: 'string' },
        env:           { type: 'object', additionalProperties: { type: 'string' } },
      },
    },
    outputs: {
      type: 'object',
      required: ['archivePath'],
      properties: {
        archivePath: { type: 'string' },
      },
    },
    runner: { kind: 'mac-runner' },
  },

  // ─── sign ────────────────────────────────────────────────────────────
  {
    id: 'sign.android',
    version: '1.0',
    category: 'sign',
    name: 'Sign Android bundle/APK',
    description: 'Sign an AAB/APK with the customer\'s signing profile (keystore from Vault).',
    inputs: {
      type: 'object',
      additionalProperties: false,
      required: ['signingProfileId', 'artifact'],
      properties: {
        signingProfileId: { type: 'string' },
        artifact:         { type: 'string', description: 'Input artifact path or stage output ref.' },
      },
    },
    outputs: {
      type: 'object',
      required: ['signedPath'],
      properties: {
        signedPath: { type: 'string' },
      },
    },
    runner: { kind: 'nomad', image: 'spinforge/builder-android' },
  },
  {
    id: 'sign.ios',
    version: '1.0',
    category: 'sign',
    name: 'Sign iOS archive → IPA',
    description: 'Export a signed .ipa from an .xcarchive using the customer\'s Apple signing profile.',
    inputs: {
      type: 'object',
      additionalProperties: false,
      required: ['signingProfileId', 'archive'],
      properties: {
        signingProfileId: { type: 'string' },
        archive:          { type: 'string' },
        exportMethod:     { type: 'string', enum: ['app-store', 'ad-hoc', 'enterprise', 'development'], default: 'app-store' },
      },
    },
    outputs: {
      type: 'object',
      required: ['ipaPath'],
      properties: {
        ipaPath: { type: 'string' },
      },
    },
    runner: { kind: 'mac-runner' },
  },

  // ─── publish ─────────────────────────────────────────────────────────
  {
    id: 'publish.appstore',
    version: '1.0',
    category: 'publish',
    name: 'Upload to App Store Connect',
    description: 'Upload a signed .ipa to App Store Connect (TestFlight or production).',
    inputs: {
      type: 'object',
      additionalProperties: false,
      required: ['ipa', 'credentialsRef'],
      properties: {
        ipa:            { type: 'string' },
        credentialsRef: { type: 'string', description: 'Vault path for App Store Connect API key.' },
        track:          { type: 'string', enum: ['testflight', 'production'], default: 'testflight' },
      },
    },
    outputs: {
      type: 'object',
      properties: {
        submissionId: { type: 'string' },
        status:       { type: 'string' },
      },
    },
    runner: { kind: 'mac-runner' },
  },
  {
    id: 'publish.playstore',
    version: '1.0',
    category: 'publish',
    name: 'Upload to Google Play',
    description: 'Upload a signed AAB to the Google Play Developer API.',
    inputs: {
      type: 'object',
      additionalProperties: false,
      required: ['aab', 'credentialsRef'],
      properties: {
        aab:            { type: 'string' },
        credentialsRef: { type: 'string', description: 'Vault path for Play Developer service account JSON.' },
        track:          { type: 'string', enum: ['internal', 'alpha', 'beta', 'production'], default: 'internal' },
      },
    },
    outputs: {
      type: 'object',
      properties: {
        editId: { type: 'string' },
        status: { type: 'string' },
      },
    },
    runner: { kind: 'nomad', image: 'spinforge/publisher-playstore' },
  },

  // ─── install ─────────────────────────────────────────────────────────
  // Atomic dependency-install steps. Separate from build.* so recipes
  // can toggle "install" independently of "build" / "test". No handlers
  // in this cut — BuildService marks them skipped_unimplemented.
  {
    id: 'install.npm',
    version: '1.0',
    category: 'install',
    name: 'Install npm dependencies',
    description: 'Run `npm ci` (or custom install command) to populate node_modules.',
    inputs: {
      type: 'object',
      additionalProperties: false,
      properties: {
        install: { type: 'string', default: 'npm ci' },
        env:     { type: 'object', additionalProperties: { type: 'string' } },
      },
    },
    outputs: {
      type: 'object',
      required: ['installed'],
      properties: {
        installed: { type: 'boolean' },
      },
    },
    runner: { kind: 'nomad', image: 'spinforge/builder-linux' },
  },
  {
    id: 'install.cocoapods',
    version: '1.0',
    category: 'install',
    name: 'Install CocoaPods',
    description: 'Run `pod install` in an iOS project directory.',
    inputs: {
      type: 'object',
      additionalProperties: false,
      properties: {
        directory: { type: 'string', default: 'ios', description: 'Directory containing the Podfile, relative to workspace root.' },
      },
    },
    outputs: {
      type: 'object',
      required: ['installed'],
      properties: {
        installed: { type: 'boolean' },
      },
    },
    runner: { kind: 'mac-runner' },
  },
  {
    id: 'install.gradle',
    version: '1.0',
    category: 'install',
    name: 'Install Gradle dependencies',
    description: 'Download and cache Gradle deps via the wrapper.',
    inputs: {
      type: 'object',
      additionalProperties: false,
      properties: {
        wrapper: { type: 'boolean', default: true, description: 'Use `./gradlew` if true, otherwise system `gradle`.' },
      },
    },
    outputs: {
      type: 'object',
      required: ['installed'],
      properties: {
        installed: { type: 'boolean' },
      },
    },
    runner: { kind: 'nomad', image: 'spinforge/builder-android' },
  },

  // ─── test ────────────────────────────────────────────────────────────
  {
    id: 'test.npm',
    version: '1.0',
    category: 'test',
    name: 'Run npm test',
    description: 'Run a Node test command and report pass/fail.',
    inputs: {
      type: 'object',
      additionalProperties: false,
      properties: {
        command: { type: 'string', default: 'npm test' },
        env:     { type: 'object', additionalProperties: { type: 'string' } },
      },
    },
    outputs: {
      type: 'object',
      required: ['passed'],
      properties: {
        passed:     { type: 'boolean' },
        reportPath: { type: 'string' },
      },
    },
    runner: { kind: 'nomad', image: 'spinforge/builder-linux' },
  },
  {
    id: 'test.xcode',
    version: '1.0',
    category: 'test',
    name: 'Run Xcode tests',
    description: 'xcodebuild test against a scheme on a macOS runner.',
    inputs: {
      type: 'object',
      additionalProperties: false,
      required: ['scheme'],
      properties: {
        scheme:      { type: 'string' },
        destination: { type: 'string', description: 'e.g. "platform=iOS Simulator,name=iPhone 15".' },
      },
    },
    outputs: {
      type: 'object',
      required: ['passed'],
      properties: {
        passed: { type: 'boolean' },
      },
    },
    runner: { kind: 'mac-runner' },
  },
  {
    id: 'test.gradle',
    version: '1.0',
    category: 'test',
    name: 'Run Gradle tests',
    description: 'Run a Gradle test task (default: `test`).',
    inputs: {
      type: 'object',
      additionalProperties: false,
      properties: {
        task: { type: 'string', default: 'test' },
      },
    },
    outputs: {
      type: 'object',
      required: ['passed'],
      properties: {
        passed: { type: 'boolean' },
      },
    },
    runner: { kind: 'nomad', image: 'spinforge/builder-android' },
  },

  // ─── package ─────────────────────────────────────────────────────────
  {
    id: 'package.zip',
    version: '1.0',
    category: 'package',
    name: 'Package directory as zip',
    description: 'Zip a directory into a single artifact ready for deploy/download.',
    inputs: {
      type: 'object',
      additionalProperties: false,
      required: ['source'],
      properties: {
        source: { type: 'string', description: 'Path to the directory to zip.' },
        dest:   { type: 'string', description: 'Output zip path. Defaults to <source>.zip.' },
      },
    },
    outputs: {
      type: 'object',
      required: ['zipPath', 'bytes'],
      properties: {
        zipPath: { type: 'string' },
        bytes:   { type: 'integer' },
      },
    },
    runner: { kind: 'nomad', image: 'spinforge/builder-linux' },
  },

  // ─── publish.registry ────────────────────────────────────────────────
  {
    id: 'publish.registry',
    version: '1.0',
    category: 'publish',
    name: 'Push image to registry',
    description: 'Push an already-built Docker image to a container registry.',
    inputs: {
      type: 'object',
      additionalProperties: false,
      required: ['imageRef'],
      properties: {
        imageRef: { type: 'string', description: 'Local image reference produced by build.container.' },
        registry: { type: 'string', description: 'Registry host (defaults to the cluster registry).' },
        tag:      { type: 'string', description: 'Tag override. Defaults to the imageRef tag.' },
      },
    },
    outputs: {
      type: 'object',
      required: ['pushedRef'],
      properties: {
        pushedRef: { type: 'string', description: 'Fully qualified pushed ref (registry/repo:tag@sha256:…).' },
      },
    },
    runner: { kind: 'inproc' },
  },

  // ─── deploy / host ───────────────────────────────────────────────────
  // `deploy.*` is the new canonical family name; `host.*` ids are kept
  // as aliases so pipelines saved before the rename continue to resolve.
  {
    id: 'deploy.static-site',
    version: '1.0',
    category: 'deploy',
    aliases: ['host.static'],
    name: 'Deploy as static site',
    description: 'Hand a static artifact to the hosting tier and register the site record.',
    inputs: {
      type: 'object',
      additionalProperties: false,
      required: ['domain', 'artifact'],
      properties: {
        domain:   { type: 'string' },
        artifact: { type: 'string', description: 'Path to the artifact dir or zip produced by an earlier stage.' },
        aliases:  { type: 'array', items: { type: 'string' }, default: [] },
      },
    },
    outputs: {
      type: 'object',
      required: ['url'],
      properties: {
        url: { type: 'string', format: 'uri' },
      },
    },
    runner: { kind: 'inproc' },
  },
  {
    id: 'deploy.container',
    version: '1.0',
    category: 'deploy',
    aliases: ['host.container'],
    name: 'Deploy as container',
    description: 'Register a Nomad service for an already-built image and wire it into OpenResty.',
    inputs: {
      type: 'object',
      additionalProperties: false,
      required: ['domain', 'imageRef'],
      properties: {
        domain:   { type: 'string' },
        imageRef: { type: 'string' },
        port:     { type: 'integer', default: 80 },
        env:      { type: 'object', additionalProperties: { type: 'string' } },
        count:    { type: 'integer', minimum: 1, default: 1 },
      },
    },
    outputs: {
      type: 'object',
      required: ['url'],
      properties: {
        url:         { type: 'string' },
        nomadJobId:  { type: 'string' },
      },
    },
    runner: { kind: 'inproc' },
  },

  // ─── util ────────────────────────────────────────────────────────────
  {
    id: 'util.webhook',
    version: '1.0',
    category: 'util',
    name: 'HTTP webhook',
    description: 'Fire an HTTP request — notify Slack, Discord, custom services.',
    inputs: {
      type: 'object',
      additionalProperties: false,
      required: ['url'],
      properties: {
        url:     { type: 'string', format: 'uri' },
        method:  { type: 'string', enum: ['GET', 'POST', 'PUT', 'PATCH'], default: 'POST' },
        headers: { type: 'object', additionalProperties: { type: 'string' } },
        body:    {},
      },
    },
    outputs: {
      type: 'object',
      properties: {
        status: { type: 'integer' },
        body:   {},
      },
    },
    runner: { kind: 'inproc' },
  },
];
