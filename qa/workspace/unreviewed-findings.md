# Unreviewed findings (QA heartbeat)

Date: 2026-04-24

## Context
Reviewed latest change in `agents` repo:
- Commit: `07ffd3d84` — `fix: project handler uses dynamic import for project-health.ts`
- File read: `agents/may/handlers/project.ts`

## Findings

### IMPORTANT — Verification blocked by missing dependencies
Could not run mandatory checks because repository root (`/app`) does not contain `node_modules`:
- `./node_modules/.bin/tsc --noEmit` → `No such file or directory`
- `./node_modules/.bin/vitest --run` → `No such file or directory`

This is an environment/setup issue; cannot independently verify compilation/tests this heartbeat.

### IMPORTANT — Handler swallows DB errors silently
In `agents/may/handlers/project.ts`, DB queries are wrapped in `try { ... } catch { /* skip */ }`.
This means failures in `ctx.getDb()` or the SQL queries will be silently ignored, potentially changing behavior (e.g., missed breached metrics / running projects) without alerting.

Evidence:
- Lines in file show:
  ```ts
  try {
    const db = ctx.getDb();
    ...
  } catch { /* skip */ }
  ```

Consider logging at least once per tick on failure (rate-limited) so operational issues are visible.

### MINOR — Dead code / unused variable
`const inflightFile = resolve(ctx.projectRoot, ".state/project-inflight");` is used, but `const stateFile` and `agentsRoot` etc. fine.
However, `importCounter` exists and is used only for workflow imports; `loadProjectHealth()` uses `Date.now()` and does not use `importCounter` (fine).
No clear bug, just note.

## Risk assessment
Main risk is inability to verify via tsc/vitest due to missing `node_modules`. Second risk is silent DB failure masking health decisions.
