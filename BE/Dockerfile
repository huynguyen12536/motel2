FROM node:24-bookworm-slim AS base
RUN apt-get update && apt-get install -y --no-install-recommends openssl ca-certificates && rm -rf /var/lib/apt/lists/*

FROM base AS dependencies
WORKDIR /app
RUN corepack enable && corepack prepare pnpm@11.22.0 --activate
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
RUN pnpm install --frozen-lockfile

FROM dependencies AS development
COPY . .
CMD ["pnpm","dev"]

FROM dependencies AS build
COPY . .
RUN pnpm build && pnpm prune --prod

FROM dependencies AS worker
WORKDIR /app
COPY . .
# Prisma CLI and migration sources are intentionally available only in the worker image.
RUN pnpm build && mkdir -p /app/logs && chown node:node /app/logs
ENV NODE_ENV=production
USER node
HEALTHCHECK --interval=15s --timeout=5s --start-period=30s --retries=3 CMD node -e "const s=JSON.parse(require('fs').readFileSync('/tmp/motel-provisioning-worker-health.json','utf8'));process.exit(s.healthy&&Date.now()-s.at<120000?0:1)"
CMD ["node","dist/src/workers/provisioning.main.js"]

FROM base AS runtime
ENV NODE_ENV=production
WORKDIR /app
COPY --from=build --chown=node:node /app/package.json ./
COPY --from=build --chown=node:node /app/node_modules ./node_modules
COPY --from=build --chown=node:node /app/dist ./dist
RUN mkdir -p /app/logs && chown node:node /app/logs
USER node
EXPOSE 8080
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 CMD node -e "fetch('http://127.0.0.1:'+(process.env.APP_PORT||process.env.PORT||8080)+'/'+(process.env.API_PREFIX||'api/v1')+'/health/live').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
CMD ["node","dist/src/index.js"]
