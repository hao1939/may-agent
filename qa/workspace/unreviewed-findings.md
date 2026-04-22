# QA Heartbeat — Unreviewed Findings (2026-04-22)

## Scope
Reviewed latest agents repo change affecting runtime handler: `agents/may/handlers/compliance-check.ts` (commit `700e41917`).

## Findings
### IMPORTANT — Misleading log message in guard smoke tests
**File:** `agents/may/handlers/compliance-check.ts`

In `runGuardSmokeTests()`, the function logs `"[compliance-check] Guard smoke tests passed"` unconditionally at the end, even if earlier checks already logged `WARN:` lines indicating failures.

This can mislead operators into thinking the guards passed when they partially failed.

**Evidence:** read output shows unconditional final `ctx.log("[compliance-check] Guard smoke tests passed");` at end of function.

### IMPORTANT — Compliance run swallows failures (may hide regression)
**File:** `agents/may/handlers/compliance-check.ts`

The returned async runner wraps guard smoke tests, convention-check, and standing-orders-check each in `try/catch` that logs an error but continues.

This may be intended (non-blocking compliance), but it also means a broken compliance system can silently degrade (especially if logs are not monitored). Consider at least emitting an event / notifying for failures, or aggregating errors and returning non-zero (if cron runner supports it).

**Evidence:** handler’s returned function catches and logs errors for each step without rethrow.

## Environment / Verification blockers
Mandatory repo-level checks could not be executed in this environment:
- `./node_modules/.bin/tsc --noEmit` fails: `No such file or directory`.
- `./node_modules/.bin/vitest --run` fails: `No such file or directory`.

This looks like missing dependencies in the sandbox rather than a patch regression.
