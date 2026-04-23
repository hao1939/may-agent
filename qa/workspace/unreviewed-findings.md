# QA Heartbeat — Unreviewed Findings (2026-04-23)

## Context
No pending events/alerts. Heartbeat focused on verifying last 6h `agents/` changes + running required checks.

## Findings
### 1) Test harness expects `/app/scripts/gym-run.sh`, but file is missing (breaks gym integration tests)
- Evidence: `vitest` run of `agents/test/gym/gym.test.ts` fails because it shells out to `bash /app/scripts/gym-run.sh`.
- The test constructs `RUN_GYM = join(PROJECT_ROOT, "scripts/gym-run.sh")` where `PROJECT_ROOT` resolves to `/app`.
- Failure output (vitest): `bash: /app/scripts/gym-run.sh: No such file or directory`.
- File evidence: `agents/test/gym/gym.test.ts` lines show `RUN_GYM` path construction.

Impact: The repo’s core `agents/test/gym` integration test suite is currently red in this environment.

Suggested fix direction: Either (a) add/restore `/app/scripts/gym-run.sh`, or (b) update tests/config to point at the correct runner location if it moved.

### 2) `vitest --run` in repo root currently executes many non-project tests (gym scenarios + caches)
- Evidence: `npx vitest --run` collected thousands of tests but also failed many files under:
  - `agents/gym/scenarios/**/environment/test/**` (many are not Vitest suites; some call `process.exit`)
  - `.state/.bun/install/cache/**` and `.state/.npm/_npx/**` (third-party package tests)
- Using `--config agents/vitest.config.mjs` still did not exclude `agents/gym/**` because the config excludes `gym/**` and `test/gym/**`, but the directory is `agents/gym/**`.

Impact: Required CI-like command `vitest --run` is noisy and fails for reasons unrelated to product code.

Suggested fix direction: Expand vitest exclude globs to include `agents/gym/**` and `.state/**` (and potentially `**/environment/test/**` under gym scenarios), or add a dedicated workspace-level vitest config.

### 3) Typecheck command `./node_modules/.bin/tsc --noEmit` cannot be run (tooling missing)
- Evidence: `/app/node_modules/.bin/tsc` does not exist; `node_modules` contains only `.vite/`.

Impact: Cannot perform the mandated typecheck step in this environment.

Suggested fix direction: Ensure dependencies are installed (package manager step), or vendor the needed binaries, or update heartbeat instructions for this environment.
