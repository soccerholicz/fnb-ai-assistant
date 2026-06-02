# Contributing

Conventions for this monorepo. These are intentionally lightweight for Phase 0 and will harden as
CI ([JAV-4](/JAV/issues/JAV-4)) and more contributors come online.

## Workflow

1. Branch off the default branch; keep changes scoped to one logical concern.
2. Run the full gate before pushing: `pnpm check` (lint + format + typecheck + test).
3. Write/update at least one test for behavior you add or change.
4. Commit in small, logical commits (see message style below).

## Toolchain

- **Package manager:** pnpm (pinned via `packageManager`; run `corepack enable` once).
- **Node:** >= 20.
- Add dependencies to the package that uses them (`pnpm --filter @jav/api add <dep>`), not the root.
  Root `devDependencies` are reserved for repo-wide tooling (ESLint, Prettier, TypeScript).

## Code style

- **Formatting is Prettier's job** — do not hand-format. `pnpm format` fixes everything.
- **Correctness is ESLint's job** — `pnpm lint` must pass with no errors.
- TypeScript is **strict**; prefer explicit types at module boundaries (API responses, tool schemas).
- Use `import type { ... }` for type-only imports (`verbatimModuleSyntax` is on).
- Local imports are extensionless (`moduleResolution: bundler`).

## Tests

- Runner is **Vitest** in every package.
- API: test the server via `buildServer(...)` + `app.inject(...)` — no real port needed.
- Web: **jsdom + Testing Library**; assert on roles/test-ids, not implementation details.

## Commits

- Imperative subject line (e.g. `add health route`), context in the body when useful.
- If you commit, the message must end with exactly:

  ```
  Co-Authored-By: Paperclip <noreply@paperclip.ing>
  ```

## Secrets

- Never commit secrets. `.env` is git-ignored; document new variables in `.env.example`.
- Keys (LLM, DB) load from the environment only.
