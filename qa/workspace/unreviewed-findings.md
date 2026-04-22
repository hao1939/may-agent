# QA Heartbeat — Unreviewed Findings (2026-04-22)

## Context
I attempted a standard verification pass for recent agent repo changes, focusing on the most recent functional commit in the last ~6h: `700e41917 fix: compliance-check handler opens DB read-write instead of readonly`.

## Evidence-backed findings

### 1) compliance-check handler: DB opened read/write in fallback path (reviewed)
- File read: `agents/may/handlers/compliance-check.ts` (full file within first 200 lines).
- The fallback `makeGetDb()` now uses `db = new Database(dbPath);` (no `{ readonly: true }`) and therefore permits writes. This matches the commit message intent.

Potential quality note:
- `runGuardSmokeTests()` always logs `"[compliance-check] Guard smoke tests passed"` even if earlier warnings were emitted (warnings are logged but no fail/return). That may be intended (best-effort smoke), but the message is slightly misleading.

### 2) Tooling / verification environment issue: repo lacks local node_modules binaries + no tsconfig
Mandatory step `./node_modules/.bin/tsc --noEmit` could not be executed because `node_modules/.bin/tsc` does not exist in either `/app` or `/app/agents`.
- Evidence: `ls node_modules/.bin` fails at repo root, and `cd agents && ls node_modules/.bin` fails (no such directory).
- `cd agents && bun x tsc --noEmit` only prints TypeScript help because there is no `tsconfig.json` in the repo root (`find . -maxdepth 3 -name tsconfig.json` returned no results).

### 3) Vitest command fails due to test suite layout / intentional failing gym scenarios
Mandatory step `./node_modules/.bin/vitest --run` also cannot be executed (no local binary), and `bun x vitest --run` fails because it discovers many gym scenario tests that intentionally call `process.exit`, have no Vitest suites, or intentionally fail assertions.
- Evidence: `cd agents && bun x vitest --run` reports `101 failed, 12 passed (113)` test files and unhandled errors.

Even narrowing to a single repo test file still fails:
- `cd agents && bun x vitest --run test/orders.test.ts` fails: cannot find module `../src/lib/orders.js`.

## Conclusion
The compliance-check change itself appears straightforward and correct in isolation, but I cannot complete required tsc/vitest verification due to the current repo/tooling/test layout. Additionally, the repo’s own `test/*.test.ts` appears broken (missing referenced source file).
