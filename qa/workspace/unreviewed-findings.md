# Unreviewed findings (QA heartbeat)

Date: 2026-04-24

## Context
Reviewed latest change in `agents` repo:
- Commit: `07ffd3d84` — `fix: project handler uses dynamic import for project-health.ts`
- File read: `agents/may/handlers/project.ts`

## Event triage
- Inbox event: 5 identical "Quick Code Review" requests.
  - Action: **dismiss as waste/duplicate**. Reason: duplicates; will do a single QA verification pass per heartbeat anyway.

## Findings

### IMPORTANT — Verification partially blocked (vitest missing in agents repo)
Mandatory checks (as configured) from within `/app/agents`:
- `./node_modules/.bin/tsc --noEmit` → **PASS** (no output, exit 0)
- `./node_modules/.bin/vitest --run` → **FAIL** (`No such file or directory`, exit 127)

Root cause appears to be that `vitest` is not installed in `agents/package.json` (it contains only `typescript` and `@types/node` as dev deps), even though `agents/vitest.config.mjs` and `agents/**.test.ts` exist.

This is an environment/dependency issue; I cannot independently run the test suite this heartbeat.

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
