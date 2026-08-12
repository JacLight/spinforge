FROM node:22-alpine

# python3/make/g++ needed so bcrypt's native bindings build (shared admin-auth).
# git is required at runtime, not build time: BuildService._populateSource
# clones a pipeline's `source: git` in-process before any stage runs, so
# without it every repo-based deploy dies with "spawn git ENOENT".
RUN apk add --no-cache openssl netcat-openbsd python3 make g++ git zip unzip

WORKDIR /app

COPY package.json ./
RUN npm install --production

COPY . .

RUN if [ -f /app/entrypoint.sh ]; then chmod +x /app/entrypoint.sh; fi

EXPOSE 8090

ENV DATA_ROOT=/data

ENTRYPOINT ["/app/entrypoint.sh"]
