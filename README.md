# F&B + Retail AI Assistant

An always-on **agentic AI "employee"** for independent restaurants, cafés, and small retail
chains. It handles customer-facing conversations (grounded FAQs, reservations, lead capture,
recovering missed inquiries) and back-office operations.

This repository is the product monorepo. It is currently at the **Phase 0 foundation skeleton**
([JAV-3](/JAV/issues/JAV-3)) — a runnable hello-world web app + API with linting, formatting,
type-checking, and tests wired up. The agent/LLM, knowledge base, chat widget, and dashboard land
in subsequent phases (see [Roadmap](#roadmap)).

---

## Stack decision & rationale

| Layer              | Choice                                    | Why                                                                                                                                                                                                                                                                                      |
| ------------------ | ----------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Language           | **TypeScript** (strict)                   | One language across server, web, and the embeddable widget. Strong typing pays off as the agent's tool schemas and API contracts grow.                                                                                                                                                   |
| Monorepo / pkgs    | **pnpm workspaces**                       | Fast, disk-efficient, strict dependency isolation. Keeps `api`, `web`, and future `widget`/shared packages in one repo with shared tooling.                                                                                                                                              |
| API / server       | **Fastify** (Node 22)                     | A standalone API is the right shape here: it serves a streaming chat agent, a public **embeddable widget** that runs on third-party restaurant sites (CORS, webhooks), and an operator dashboard. Fastify is fast, schema-first, and has first-class streaming + testability (`inject`). |
| Web frontend       | **React + Vite**                          | The operator dashboard is a SPA; Vite gives instant dev and a small production build. Kept separate from the API so the dashboard and widget can deploy independently.                                                                                                                   |
| Build (API)        | **tsup** (esbuild)                        | Produces a clean single-file ESM bundle — avoids Node ESM extension friction and gives fast, deploy-ready output for Phase 0.2 CI/CD.                                                                                                                                                    |
| Database (planned) | **Postgres** via **Neon** + Drizzle ORM   | Managed, serverless Postgres with a generous free tier and `pgvector` support — covers both relational data (businesses, conversations, leads) and RAG embeddings ([JAV-6]). Wired in [JAV-5]/[JAV-6].                                                                                   |
| LLM (planned)      | **Anthropic Claude** (tool-calling)       | Best-in-class native tool-calling + streaming, which the agent core depends on. Wired in [JAV-5]. Provider access is isolated behind one module so it stays swappable.                                                                                                                   |
| Lint / format      | **ESLint 9** (flat config) + **Prettier** | Industry standard. Prettier owns formatting; ESLint owns correctness.                                                                                                                                                                                                                    |
| Tests              | **Vitest**                                | Unified test runner for both server (Fastify `inject`) and web (jsdom + Testing Library). Fast, Vite-native, zero extra config.                                                                                                                                                          |
| CI                 | **GitHub Actions**                        | Lint + format + typecheck + test + build on every PR and push to `main`. Free unlimited minutes on a public repo; native pnpm caching.                                                                                                                                                   |
| Deploy (web)       | **GitHub Pages**                          | The SPA is static — Pages serves it for free via the built-in token, no extra account. This is the live skeleton URL.                                                                                                                                                                    |
| Deploy (API)       | **Fly.io** (Docker)                       | The API is a long-lived process (streams agent responses in [JAV-5]) so it needs a real Node host, not static hosting. Fly is Docker-based, health-checked, scales to zero. Deploy is gated on a `FLY_API_TOKEN` secret. See [DEPLOYMENT.md](./DEPLOYMENT.md).                           |

> **Why not Next.js?** A coupled full-stack framework would tie the dashboard's deploy to the API
> and can't host the embeddable widget (which must run as a tiny standalone bundle on customer
> sites). A standalone API + independent web app matches the product's actual surfaces.

The package scope `@jav/*` and the working name follow the issue prefix; **product branding is a
CEO/design decision** and intentionally left as design debt.

[JAV-4]: /JAV/issues/JAV-4
[JAV-5]: /JAV/issues/JAV-5
[JAV-6]: /JAV/issues/JAV-6

---

## Repository layout

```
.
├── apps/
│   ├── api/            # Fastify API server (TypeScript)
│   │   ├── src/        #   server factory, entrypoint, routes/
│   │   └── test/       #   Vitest tests (via fastify.inject)
│   └── web/            # React + Vite operator/web app
│       └── src/        #   App, entrypoint, tests
├── packages/           # (future) shared libs: agent core, widget, db client
├── eslint.config.mjs   # Flat ESLint config (TS + React)
├── tsconfig.base.json  # Shared compiler options
├── pnpm-workspace.yaml
└── package.json        # Root scripts: dev / build / lint / typecheck / test
```

---

## Prerequisites

- **Node.js >= 20** (developed on 22)
- **pnpm** (this repo pins it via `packageManager`; enable with `corepack enable`)

---

## Getting started

```bash
# 1. Install all workspace dependencies
pnpm install

# 2. (optional) create your local env file
cp .env.example .env

# 3. Run API + web together (hot reload)
pnpm dev
```

- Web app: <http://localhost:5173>
- API: <http://localhost:8080> (health check at `/health`)

The web app calls `/api/health`; in dev, Vite proxies `/api/*` to the API. The hello-world page
shows the live API status to prove the two halves are wired together.

### Run one app at a time

```bash
pnpm --filter @jav/api dev     # API only
pnpm --filter @jav/web dev     # web only
```

---

## Quality gates

| Command          | What it does                                              |
| ---------------- | --------------------------------------------------------- |
| `pnpm lint`      | ESLint across the monorepo                                |
| `pnpm format`    | Prettier write (`format:check` to verify only)            |
| `pnpm typecheck` | `tsc --noEmit` in every package                           |
| `pnpm test`      | Vitest in every package                                   |
| `pnpm build`     | Build all packages (`tsup` for API, `vite build` for web) |
| `pnpm check`     | lint + format:check + typecheck + test (the full gate)    |

These checks run in CI on every PR and push to `main` ([JAV-4]). See
[Deployment & CI/CD](#deployment--cicd) for the live URLs and deploy steps.

---

## Deployment & CI/CD

- **CI** — GitHub Actions runs the full gate (lint + format + typecheck + test + build) on every
  PR and push to `main`.
- **Web** — deployed to **GitHub Pages** on every push to `main`. Live skeleton URL:
  `https://<owner>.github.io/<repo>/`.
- **API** — Docker image deployed to **Fly.io** (gated on a `FLY_API_TOKEN` secret).

Full setup, one-time steps, and how to wire the live API URL into the web app are in
**[DEPLOYMENT.md](./DEPLOYMENT.md)**.

---

## Roadmap

**Phase 0 — Foundation**

- **JAV-3** — Stack decision, repo, app skeleton
- **JAV-4** — CI/CD pipeline + live deploy target ← _this repo's current state_
- [JAV-5] — Agent core: LLM integration, tool-calling, conversation state
- [JAV-6] — Knowledge base ingestion + grounded answers (RAG)

**Phase 1 — Product**

- JAV-7 — Embeddable chat widget
- JAV-8 — Reservation / lead capture flow
- JAV-9 — Operator dashboard
- JAV-10 — End-to-end pilot demo with a restaurant's data

See [CONTRIBUTING.md](./CONTRIBUTING.md) for conventions.
