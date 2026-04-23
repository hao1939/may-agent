# QA Heartbeat Findings (2026-04-23)

## Context
This repo checkout does **not** appear to be a git repository (`git log` fails with `fatal: not a git repository`). That prevents the usual “what changed in last 6h” diff-based verification.

## Verification checks

### TypeScript (`./node_modules/.bin/tsc --noEmit`)
**FAIL (environment/tooling)** — `./node_modules/.bin/tsc` is missing.

Evidence:
- `./node_modules/.bin/tsc --noEmit` → `/bin/bash: line 1: ./node_modules/.bin/tsc: No such file or directory`
- `npx tsc --noEmit` → "This is not the tsc command you are looking for" (TypeScript not installed)

### Vitest (`./node_modules/.bin/vitest --run`)
**FAIL** — running `npx vitest --run` executes a very broad test set including many `agents/gym/scenarios/**` fixtures and `.state/**` cached package tests, producing massive failures unrelated to the main application.

Evidence (sample):
- Many failures are from fixture tests calling `process.exit()` (Vitest flags this as an error).
- Some failures are from third-party cache tests under `.state/.bun/install/cache/**` due to missing deps or incompatible test frameworks.

The summary reported by vitest:
- `Test Files 153 failed | 324 passed (477)`
- `Tests 1 failed | 3660 passed (3661)`

## Files reviewed
- `agents/optimizer/workflows/enhance-cron.ts`
  - Contains a change replacing an LLM call at step 6 with `ctx.runFunction("final-verify", ...)` using `execSync` to run `npx tsc` and `npx vitest`.

## Issues
### IMPORTANT: Final verification step uses `npx tsc` but TypeScript is not installed
In `agents/optimizer/workflows/enhance-cron.ts`, the new pure-JS verification uses:
- `execSync("npx tsc --noEmit 2>&1")`

In this environment, `npx tsc` fails because `typescript` is not installed, meaning the workflow’s final verification will always report `tsc result: FAIL` even if the code is correct.

### IMPORTANT: `npx vitest run run/cron.test.ts` may be the only safe test target
Running `npx vitest --run` from repo root currently runs a huge set of fixture/cached tests and fails. Workflows and humans should run a targeted test (e.g., `npx vitest run run/cron.test.ts`) rather than the whole tree.

### MINOR: `testPass` detection is fragile
`testPass = !testOut.toUpperCase().includes("FAIL")` can misclassify outputs:
- could contain “FAIL” in a skipped snapshot message or file path even when overall pass
- better to rely on exit code (already caught by try/catch) rather than output substring

## Recommendations
1. Ensure `typescript` is present in dependencies (or provide an internal `tsc` path) so `npx tsc` is reliable.
2. Add a vitest include/exclude pattern in config so fixture tests under `agents/gym/scenarios/**` and caches under `.state/**` are not discovered by default.
3. In `final-verify`, treat vitest success purely by exit code; don’t parse output for "FAIL".
