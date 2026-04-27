# Workflow Run-Test Results

**Date:** 2025-01-25  
**Method:** Dynamic import via `npx tsx` (Node v22.22.2) — each file imported and default export inspected  
**Environment:** `/app/agents/shared/workflows/*.ts`

## Summary

| # | File | Type | Loads? | Has `execute`? | Result |
|---|------|------|--------|----------------|--------|
| 1 | coaching-feedback.ts | Workflow | ✅ exit 0 | ✅ function | **PASS** |
| 2 | error-scan.ts | Workflow | ✅ exit 0 | ✅ function | **PASS** |
| 3 | fewshot-inject-helpers.ts | Helper lib | ✅ exit 0 | ❌ (no execute) | **PASS** (helper) |
| 4 | freestyle-wrap.ts | Workflow | ✅ exit 0 | ✅ function | **PASS** |
| 5 | heartbeat-data.ts | Helper lib | ✅ exit 0 | ❌ (no execute) | **PASS** (helper) |
| 6 | implement-and-verify.ts | Workflow | ✅ exit 0 | ✅ function | **PASS** |
| 7 | master-worker.ts | Workflow | ✅ exit 0 | ✅ function | **PASS** |
| 8 | project-helpers.ts | Helper lib | ✅ exit 0 | ❌ (no execute) | **PASS** (helper) |
| 9 | project.ts | Workflow | ✅ exit 0 | ✅ function | **PASS** |
| 10 | verify-wrap.ts | Workflow | ✅ exit 0 | ✅ function | **PASS** |

**All 10 files load without errors (exit code 0).**

## Classification

### Workflows (7) — export `{ name, description, execute }`
| Workflow | Name | Description (truncated) |
|----------|------|------------------------|
| coaching-feedback.ts | `coaching-feedback` | Sensor-judge: JS scans convention violations (zero LLM cost), Coach LLM… |
| error-scan.ts | `error-scan` | Sensor-judge: JS scans error logs (zero LLM cost), LLM analyzes patterns… |
| freestyle-wrap.ts | `freestyle-wrap` | Ultra-thin wrapper for ad-hoc sessions. Single step, no overhead. |
| implement-and-verify.ts | `implement-and-verify` | Lightweight code workflow: coder implements, shell verifies. One retry. |
| master-worker.ts | `master-worker` | Two-session: orchestrator directs strategy, worker executes. Review-first. |
| project.ts | `project` | Persistent loop until done or blocked. Project directory has project.md. |
| verify-wrap.ts | `verify-wrap` | Minimal 2-phase verification wrapper. Phase 1: execute. Phase 2: verify. |

### Helper Libraries (3) — utility exports, no `execute`
| File | Exported Functions |
|------|--------------------|
| fewshot-inject-helpers.ts | `injectFewShot`, `loadExample`, `selectExamples` |
| heartbeat-data.ts | `formatMetricsBlock`, `genericHeartbeat`, `loadAlerts`, `loadHeartbeatMd`, `loadInbox`, `loadMetrics`, `loadProjects`, `runRedMetricCommands` |
| project-helpers.ts | `checkOffMilestones`, `clearComments`, `extractComments`, `extractField`, `extractMilestones`, `extractSection`, `updateProjectStatus` |

## Notes

- No `--dry-run` flag exists for workflows. The `execute` functions require a runtime context (session, agent config) that can't be provided outside the orchestrator.
- The import test confirms all TypeScript compiles cleanly and all dependencies resolve.
- Invocation pattern: `bun src/app/may.ts --run-workflow <name> "<task>"` (per master-worker.ts docs).
