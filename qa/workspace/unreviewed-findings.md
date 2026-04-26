# QA Heartbeat — Unreviewed Findings (2026-04-26)

## Scope checked
- Root repo `git log -10` shows latest commit: `e1e62c2 scout: triage arXiv...`.
- `agents/` sub-repo latest commit: `c891a7a4c amy: gym session - all tests already passing`.

## Findings
### 1) Test/Typecheck commands in QA SOP do not work at repo root (environment/config)
- `./node_modules/.bin/tsc --noEmit` at `/app` prints TypeScript help and exits code 1 because there is **no `tsconfig.json` at repo root**.
- `./node_modules/.bin/vitest --run` at `/app` fails with `No such file or directory` because **vitest is not installed at repo root**.

However, within the `agents/` sub-repo:
- `../node_modules/.bin/tsc --noEmit -p tsconfig.json` in `/app/agents` succeeds.
- `vitest.config.mjs` exists in `/app/agents`, but `vitest` is not installed there either (no `node_modules/.bin/vitest`).

**Impact:** QA cannot execute the mandated checks as written without additional setup. This appears pre-existing and not attributable to a recent patch.

### 2) Recent change content
- Only file changed in latest `agents/` commit is `agents/amy/last-session.md` (auto-generated session log). No product code changes observed.
