# Deployment & CI/CD

Phase 0.2 ([JAV-4](/JAV/issues/JAV-4)) wiring: continuous verification on every change and a
live deploy of the skeleton.

## Overview

| Surface       | Target                | Trigger                    | Secret needed   | Status                       |
| ------------- | --------------------- | -------------------------- | --------------- | ---------------------------- |
| Quality gate  | GitHub Actions (`ci`) | every PR + push to `main`  | none            | ✅ live                      |
| Web (SPA)     | GitHub Pages          | push to `main`             | none            | ✅ live                      |
| API (Fastify) | Fly.io                | push to `main` (api paths) | `FLY_API_TOKEN` | ⏳ ready — token not yet set |

Web and API deploy **independently** (see the stack rationale in [README](./README.md)). The web
app is the live, demoable skeleton URL; the API is deployed separately and the web app points at
it via `VITE_API_BASE_URL` once it is live.

## CI — `.github/workflows/ci.yml`

Runs on every pull request and every push to `main`:

```
pnpm install --frozen-lockfile
pnpm lint          # ESLint
pnpm format:check  # Prettier
pnpm typecheck     # tsc --noEmit (all packages)
pnpm test          # Vitest (all packages)
pnpm build         # tsup (api) + vite build (web)
```

This is the same gate as `pnpm check`, plus a build. Branch protection on `main` can require the
`check` job once the team grows.

## Web → GitHub Pages — `.github/workflows/deploy-web.yml`

No external account or secret required — Pages publishes via the built-in `GITHUB_TOKEN`.

**One-time setup** (already done for this repo; repeat if you recreate it):

```bash
# Set the Pages source to GitHub Actions.
gh api -X POST repos/<owner>/<repo>/pages -f build_type=workflow
```

On every push to `main` the workflow builds the SPA and deploys it. Two build-time knobs:

- `VITE_BASE` — set automatically to `/<repo>/` so assets resolve under the project site.
- `VITE_API_BASE_URL` — **repo variable** pointing the SPA at the live API. Set it once the API
  is deployed so the live page shows a green API status:

  ```bash
  gh variable set VITE_API_BASE_URL --body "https://fnb-ai-assistant-api.fly.dev"
  ```

  Until then the SPA shows "API unreachable" (expected — the API host is pending, see below).

**Live URL:** `https://<owner>.github.io/<repo>/`

## API → Fly.io — `.github/workflows/deploy-api.yml`

The API runs as a long-lived Fastify process (it will stream agent responses in
[JAV-5](/JAV/issues/JAV-5)), so it needs a real Node host rather than static hosting. Fly.io fits:
Docker-based, health-checked, scales to zero. Config lives in [`fly.toml`](./fly.toml) and
[`Dockerfile`](./Dockerfile).

The deploy job is **gated** on the `FLY_API_TOKEN` secret. Until it is set, the job logs a notice
and no-ops — it never fails CI. To go live:

**One-time setup (requires a Fly.io account — a budget/account decision, see JAV-4 escalation):**

```bash
# 1. Install flyctl and sign in
brew install flyctl        # or: curl -L https://fly.io/install.sh | sh
fly auth login

# 2. Create the app (name must match `app` in fly.toml)
fly apps create fnb-ai-assistant-api

# 3. Mint a deploy token and add it to GitHub repo secrets
fly tokens create deploy -x 999999h            # copy the token
gh secret set FLY_API_TOKEN --body "<token>"

# 4. First deploy (or just push to main — the workflow takes over after this)
fly deploy --remote-only
```

The health check hits `GET /health` (see `fly.toml [[http_service.checks]]`).

**After the API is live**, set the `VITE_API_BASE_URL` repo variable (above) and re-run the web
deploy so the live page talks to the API end-to-end.

## Local verification

```bash
pnpm check        # the exact gate CI runs (minus build)
pnpm build        # produce deploy artifacts locally
pnpm --filter @jav/api start   # run the built API on :8080
```
