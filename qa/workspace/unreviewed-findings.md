# Unreviewed Findings (QA heartbeat)

## Context
- Repo root (`/app`) is **not** a git repository. The `agents/` directory **is** a git repository.
- Latest commit in `agents/` at time of review: `a2cdaad4e` (coach HB46: triage notifications, journal update, EXP-199/200 ready for execution).

## Findings
### 1) Tooling/verification gap: mandatory `tsc`/`vitest` checks cannot run (environment)
**Severity:** IMPORTANT (blocks standard QA verification; likely infra/config issue)

Evidence:
- Running `./node_modules/.bin/tsc --noEmit` at `/app` fails: `No such file or directory`.
- Running `./node_modules/.bin/vitest --run` at `/app` fails: `No such file or directory`.
- In `agents/` repo, `./node_modules/.bin/tsc --noEmit` also fails: `No such file or directory`.
- `agents/package.json` declares `typescript` in `devDependencies`, but `npm ls --depth=0` shows only `puppeteer-core@24.42.0` installed and `node_modules/.package-lock.json` contains no `typescript` entries.

Impact:
- QA cannot perform the mandated independent TypeScript/typecheck and unit test verification steps in this environment.

Suggested follow-up:
- Ensure the workspace has dependencies installed (e.g., `npm ci`) for the relevant repo and that `vitest` is included where expected.

### 2) Recent change scope appears documentation-only
**Severity:** MINOR

Evidence:
- `git show --name-only -1` for `a2cdaad4e` lists only markdown files:
  - `bob/last-session.md`
  - `coach/last-session.md`
  - `coach/workspace/journal.md`
  - `evaluator/last-session.md`

I spot-checked `agents/coach/workspace/journal.md` (first 200 lines) and it contains logging/notes, not code.
