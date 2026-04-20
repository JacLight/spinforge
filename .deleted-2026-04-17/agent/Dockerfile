FROM node:20-alpine

WORKDIR /app

COPY package*.json ./
RUN npm install --production --no-audit --no-fund

COPY agent.js ./

# Non-root is not practical — the agent needs r/w on the docker
# socket. Dropping to a group that matches the host's docker gid
# would let us go non-root, but gid differs across hosts. Leave as
# root inside the container; the container itself has only the
# narrowly-scoped socket + /proc.
USER root

CMD ["node", "agent.js"]
