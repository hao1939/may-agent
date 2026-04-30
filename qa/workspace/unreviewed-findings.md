# Unreviewed findings (QA heartbeat)

## Scope
Reviewed latest commit in /app/agents:
- `15691e2a5 coach: 2-phase heartbeat workflow for structured planning enforcement (M11)`
  - File: `coach/workflows/coach-heartbeat.ts`

## Findings

### 1) CRITICAL — `tsc --noEmit` fails in agents repo (barrel re-export ambiguity)
`./node_modules/.bin/tsc --noEmit` fails with TS2308 errors in `shared/lib/index.ts`, complaining about duplicate exports (`IterationRecord`, `ValidationResult`). This blocks typecheck-based CI and indicates an API ambiguity in the shared barrel exports.

Evidence:
- `shared/lib/index.ts(13,1)`: TS2308 duplicate export `IterationRecord`
- `shared/lib/index.ts(16,1)`: TS2308 duplicate export `ValidationResult`

Likely cause:
- `export * from './iteration-monitor.js'` and/or `export * from './task-validator.js'` re-export names that are also exported elsewhere via other `export *` statements. Needs explicit re-export or rename to avoid conflict.

### 2) IMPORTANT — Heartbeat "no action needed" guard is brittle
In `coach/workflows/coach-heartbeat.ts`, skipping phase 2 is conditional on:
```ts
if (planText.toLowerCase().includes("no action needed") && !hasRedMetrics && !alerts && !inbox)
```
But `alerts`/`inbox` are strings produced by loaders; they can be truthy even when they represent "None — all clear." / "No pending events.". This may cause phase 2 to run unnecessarily.

This isn’t necessarily wrong, but it defeats the intent of the optimization. Consider checking the normalized rendered strings or using the underlying structured data rather than raw strings.

## Test status
- `vitest --run`: PASS (536 tests)
- `tsc --noEmit`: FAIL (TS2308 duplicate exports)
