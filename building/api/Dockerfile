FROM node:22-alpine

# python3/make/g++ needed so bcrypt's native bindings build (shared admin-auth).
# git is required at runtime, not build time: BuildService._populateSource
# clones a pipeline's `source: git` in-process before any stage runs, so
# without it every repo-based deploy dies with "spawn git ENOENT".
RUN apk add --no-cache openssl netcat-openbsd python3 make g++ git zip unzip curl

# Railpack, for repo inspection.
#
# The API needs to answer "what is this repo and how does it build?" while
# a user is waiting on a form, so detection runs here rather than as a
# Nomad stage job — a shallow clone plus `railpack info` is seconds, a
# dispatched build job is not.
#
# Same pre-warm as the runner image: `railpack` fetches mise from GitHub
# on first use, and that download is the single flakiest step in the whole
# pipeline (two builds died on 503s before it was baked in).
ARG RAILPACK_VERSION=0.36.4
RUN curl -fsSL -o /tmp/railpack.tar.gz \
      "https://github.com/railwayapp/railpack/releases/download/v${RAILPACK_VERSION}/railpack-v${RAILPACK_VERSION}-x86_64-unknown-linux-musl.tar.gz" \
  && tar xzf /tmp/railpack.tar.gz -C /usr/local/bin railpack \
  && chmod +x /usr/local/bin/railpack \
  && rm -f /tmp/railpack.tar.gz \
  && mkdir -p /tmp/warm \
  && printf '{"name":"warm","version":"1.0.0","scripts":{"start":"node index.js"}}' > /tmp/warm/package.json \
  && (railpack prepare /tmp/warm --plan-out /tmp/warm/plan.json --info-out /tmp/warm/info.json >/dev/null 2>&1 || true) \
  && rm -rf /tmp/warm \
  && railpack --version

WORKDIR /app

COPY package.json ./
RUN npm install --production

COPY . .

RUN if [ -f /app/entrypoint.sh ]; then chmod +x /app/entrypoint.sh; fi

EXPOSE 8090

ENV DATA_ROOT=/data

ENTRYPOINT ["/app/entrypoint.sh"]
