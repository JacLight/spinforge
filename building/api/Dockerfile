FROM node:22-alpine

# python3/make/g++ needed so bcrypt's native bindings build (shared admin-auth).
RUN apk add --no-cache openssl netcat-openbsd python3 make g++

WORKDIR /app

COPY package.json ./
RUN npm install --production

COPY . .

RUN if [ -f /app/entrypoint.sh ]; then chmod +x /app/entrypoint.sh; fi

EXPOSE 8090

ENV DATA_ROOT=/data

ENTRYPOINT ["/app/entrypoint.sh"]
