# MagePop PVP server image. Build from the repo root:
#   docker build -f packages/server/Dockerfile -t magepop-server .
# The server is bundled into one file, so the final image is just Node + server.cjs.

FROM node:26-alpine AS build
WORKDIR /app
# Workspace manifests first (better layer caching); only the server's dependencies get installed.
COPY package.json package-lock.json ./
COPY packages/core/package.json packages/core/
COPY packages/server/package.json packages/server/
COPY packages/client/package.json packages/client/
COPY apps/desktop/package.json apps/desktop/
RUN npm ci --workspace @magepop/server --include-workspace-root=false --ignore-scripts --no-audit --no-fund
COPY packages/core packages/core
COPY packages/server packages/server
RUN npm run build -w @magepop/server

FROM node:26-alpine
# su-exec: drop from root to the "node" user after fixing the stats volume's ownership.
RUN apk add --no-cache su-exec
WORKDIR /app
ENV NODE_ENV=production
COPY --from=build /app/packages/server/dist/server.cjs ./server.cjs
EXPOSE 8787
# A freshly mounted volume is owned by root. Hand it to "node", then run the server as "node"
# (never root): the only thing that runs as root is this chown.
CMD ["sh", "-c", "if [ -n \"$STATS_DIR\" ] && [ -d \"$STATS_DIR\" ]; then chown node:node \"$STATS_DIR\"; fi; exec su-exec node node server.cjs"]
