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

WORKDIR /app

COPY package.json ./
RUN npm install --production

COPY agent.js entrypoint.sh ./
RUN chmod +x entrypoint.sh

ENV NODE_ENV=production

ENTRYPOINT ["/app/entrypoint.sh"]
