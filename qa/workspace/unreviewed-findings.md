# QA Heartbeat — Unreviewed Findings (2026-04-26)

## Context
- Repo root (`/app`) is **not** a git repository; the only git repo detected is `/app/agents`.
- Recent commits in `agents/` are session-note updates (e.g., `amy/last-session.md`).

## Findings
### 1) Tooling mismatch with mandatory QA commands (environment)
- At `/app`:
  - `./node_modules/.bin/tsc --noEmit` exits **1** because there is **no tsconfig.json**, so `tsc` prints help instead of compiling.
  - `./node_modules/.bin/vitest --run` fails because **vitest is not installed** in `/app/node_modules`.
- In `/app/agents`:
  - `./node_modules/.bin/tsc --noEmit` passes (no output, exit 0).
  - `./node_modules/.bin/vitest --run` fails because **vitest is not installed** in `agents/node_modules` either.

Impact: I cannot complete the mandated “vitest --run” verification step in this environment. If vitest is expected, it needs to be added to the relevant package.json (root vs agents) or the QA checklist should specify an alternative test runner.

### 2) Only substantive changed file observed
- `agents/amy/last-session.md` was updated in commit `e02faa2f0` (session note change only). No functional code changes detected in the last 10 commits.
