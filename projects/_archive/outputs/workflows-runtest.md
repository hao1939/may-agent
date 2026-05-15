# Workflow Run-Test Results

**Date:** 2025-01-25  
**Method:** Dynamic import via `npx tsx -e "import('file:///app/agents/shared/workflows/<file>.ts')"` with 15s timeout  
**Environment:** Node.js + tsx, project root `/app`

## Summary

- **10 workflow files tested**
- **10/10 loaded successfully** (exit code 0)
- **7 are executable workflows** (have `name` + `execute()`)
- **3 are helper/utility modules** (export functions, no `execute()`)

## Results Table

| # | File | Exit Code | Load Result | Type | Exports |
|---|------|-----------|-------------|------|---------|
| 1 | `coaching-feedback.ts` | 0 | ✅ PASS | Workflow | name: `coaching-feedback`, has `execute()` |
| 2 | `error-scan.ts` | 0 | ✅ PASS | Workflow | name: `error-scan`, has `execute()` |
| 3 | `fewshot-inject-helpers.ts` | 0 | ✅ PASS | Helper | `injectFewShot`, `loadExample`, `selectExamples` |
| 4 | `freestyle-wrap.ts` | 0 | ✅ PASS | Workflow | name: `freestyle-wrap`, has `execute()` |
| 5 | `heartbeat-data.ts` | 0 | ✅ PASS | Helper | `formatMetricsBlock`, `genericHeartbeat`, `loadAlerts`, `loadHeartbeatMd`, `loadInbox`, `loadMetrics`, `loadProjects`, `runRedMetricCommands` |
| 6 | `implement-and-verify.ts` | 0 | ✅ PASS | Workflow | name: `implement-and-verify`, has `execute()` |
| 7 | `master-worker.ts` | 0 | ✅ PASS | Workflow | name: `master-worker`, has `execute()` |
| 8 | `project-helpers.ts` | 0 | ✅ PASS | Helper | `checkOffMilestones`, `clearComments`, `extractComments`, `extractField`, `extractMilestones`, `extractSection`, `updateProjectStatus` |
| 9 | `project.ts` | 0 | ✅ PASS | Workflow | name: `project`, has `execute()` |
| 10 | `verify-wrap.ts` | 0 | ✅ PASS | Workflow | name: `verify-wrap`, has `execute()` |

## Classification

### Executable Workflows (7)
These export a default object with `name` and `execute()` — they can be dispatched by the workflow engine:

1. **coaching-feedback** — coaching/feedback workflow
2. **error-scan** — error scanning workflow
3. **freestyle-wrap** — freestyle task wrapper
4. **implement-and-verify** — implementation + verification pipeline
5. **master-worker** — master-worker coordination pattern
6. **project** — project management workflow
7. **verify-wrap** — verification wrapper

### Helper Modules (3)
These export utility functions consumed by workflows, not directly executable:

1. **fewshot-inject-helpers** — few-shot example injection for prompts
2. **heartbeat-data** — heartbeat/metrics data loading utilities
3. **project-helpers** — project file parsing and milestone tracking

## Notes

- No `--run-workflow --dry-run` CLI flag was found. The workflow engine uses a guard loader (`agents/shared/guards/loader.ts`) that dynamically imports guard files at runtime.
- All files use default exports. The 7 workflows export `{ name, execute }` objects; the 3 helpers export objects with named utility functions.
- No runtime errors, missing dependencies, or type errors were encountered during import testing.
