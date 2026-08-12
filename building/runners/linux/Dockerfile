# SpinBuild Linux runner
#
# Handles web / generic linux builds. Runs as a Nomad docker-driver task.
# LXC native driver may replace docker later (see PLATFORM_PLAN.md §3);
# the agent itself is driver-agnostic.
#
# Tagged as spinforge/builder-linux:latest. Referenced by
# DispatchService PLATFORM_PROFILES.web / .linux.

FROM node:22-bookworm-slim

# Build tooling customers commonly need. Keep this lean — heavy toolchains
# belong in specialized runner images (android, flutter, electron).
RUN apt-get update && apt-get install -y --no-install-recommends \
      git \
      ca-certificates \
      curl \
      zip \
      unzip \
      xz-utils \
      python3 \
      build-essential \
  && rm -rf /var/lib/apt/lists/*

# Railpack: detects the project's language, package manager, toolchain
# version and build command, then drives BuildKit to build it. Replaces
# the hardcoded `npm ci && npm run build` for BUILD_MODE=railpack stages.
#
# It only plans and dispatches — the actual work happens in buildkitd on
# the build node, reached over the socket bind-mounted at /run/buildkit.
ARG RAILPACK_VERSION=0.36.4
RUN curl -fsSL -o /tmp/railpack.tar.gz \
      "https://github.com/railwayapp/railpack/releases/download/v${RAILPACK_VERSION}/railpack-v${RAILPACK_VERSION}-x86_64-unknown-linux-musl.tar.gz" \
  && tar xzf /tmp/railpack.tar.gz -C /usr/local/bin railpack \
  && chmod +x /usr/local/bin/railpack \
  && rm -f /tmp/railpack.tar.gz \
  && railpack --version

WORKDIR /app

COPY package.json ./
RUN npm install --production

COPY agent.js entrypoint.sh ./
RUN chmod +x entrypoint.sh

# Deliberately NOT setting NODE_ENV=production.
#
# The agent's own deps are already installed lean via `npm install
# --production` above, so the env var bought nothing at runtime — but it
# broke every customer build: `npm ci` under NODE_ENV=production omits
# devDependencies, and for a front-end project that's where the build
# tooling lives. A Vite app would install 396 prod packages and then die
# with "Cannot find module '@vitejs/plugin-react'".
#
# Bundlers don't need it either: `vite build` sets production mode itself.
# Customers who want it can pass it through their manifest env.

ENTRYPOINT ["/app/entrypoint.sh"]
