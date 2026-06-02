# Production image for the @jav/api Fastify server (monorepo-aware).
# Build context is the repo root so the pnpm workspace install resolves.
#
# Deliberately simple and reliable: install the full workspace, build the API
# bundle, then run it from the package dir where pnpm wired its node_modules.
# Image-size optimization (prune dev deps / multi-stage) is deferred; the
# skeleton API is tiny and correctness matters more than a few hundred MB here.

FROM node:22-slim
RUN corepack enable
WORKDIR /repo

# Copy the workspace (node_modules/dist excluded via .dockerignore) and install
# with the lockfile for a reproducible build. Dev deps are needed to build.
COPY . .
RUN pnpm install --frozen-lockfile \
  && pnpm --filter @jav/api build

# Production runtime settings (also set by fly.toml [env]).
ENV NODE_ENV=production
ENV PORT=8080

WORKDIR /repo/apps/api
EXPOSE 8080
CMD ["node", "dist/index.js"]
