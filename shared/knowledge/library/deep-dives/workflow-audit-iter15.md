# Workflow Audit — Iteration 15

## Baseline Metrics (24h snapshot)
- **Total sessions**: 1,158
- **Workflow sessions**: 341 (29% coverage)
- **Freestyle sessions**: 817
- **Heartbeat sessions**: 684 (59% of all sessions — the biggest gap)

## Existing Workflows (8 total)

### KEEP — Active & Working
| Workflow | Location | Status |
|----------|----------|--------|
| `heartbeat` | `agents/shared/workflows/heartbeat.ts` | Shared fallback — **DEMOTED** by per-agent versions |
| `implement-and-verify` | `agents/shared/workflows/implement-and-verify.ts` | Active, used by tech-lead & QA |
| `implement-and-review` | `agents/shared/workflows/implement-and-review.ts` | Active |
| `verify-wrap` | `agents/shared/workflows/verify-wrap.ts` | Active, used by QA |
| `parallel-research` | `agents/shared/workflows/parallel-research.ts` | Active, used by scout |
| `persistent-task` | `agents/shared/workflows/persistent-task.ts` | Active (57 sessions/24h) |

### KEEP — Agent-Specific
| Workflow | Location | Status |
|----------|----------|--------|
| `safe-edit` | `agents/optimizer/workflows/safe-edit.ts` | Active |
| `design-review` | `agents/optimizer/workflows/design-review.ts` | Active |
| `investigate-and-fix` | `agents/optimizer/workflows/investigate-and-fix.ts` | Active |
| `enhance-cron` | `agents/optimizer/workflows/enhance-cron.ts` | Active |

### NEW — Per-Agent Heartbeat Workflows (created this iteration)
| Workflow | Location |
|----------|----------|
| `may-heartbeat` | `agents/may/workflows/may-heartbeat.ts` |
| `bob-heartbeat` | `agents/bob/workflows/bob-heartbeat.ts` |
| `coach-heartbeat` | `agents/coach/workflows/coach-heartbeat.ts` |
| `optimizer-heartbeat` | `agents/optimizer/workflows/optimizer-heartbeat.ts` |
| `scout-heartbeat` | `agents/scout/workflows/scout-heartbeat.ts` |
| `tech-lead-heartbeat` | `agents/tech-lead/workflows/tech-lead-heartbeat.ts` |
| `qa-heartbeat` | `agents/qa/workflows/qa-heartbeat.ts` |

## Coverage Impact Projection

### Before (29%)
- 341 workflow sessions / 1,158 total

### After (projected ~75-80%)
- Heartbeats (684 sessions) now route through `run-workflow` handler → tracked with `workflowRunId`
- Expected: 341 + 684 = 1,025 workflow sessions → **88% coverage**
- Even accounting for some edge cases: **~80% minimum**

## Top 3 Freestyle Patterns (from session archaeology)
1. **Task Tree Evaluation** — 399 sessions (49% of freestyle). Already a pseudo-workflow but sessions lack `workflowRunId`.
2. **[heartbeat] agent sessions** — 263 sessions (32% of freestyle). **FIXED** by cron.json migration.
3. **persistent-task** — 57 sessions. Already uses workflow but some invocations are freestyle.

## Changes Made
1. Created `agents/shared/workflows/agent-heartbeat.ts` — factory for per-agent heartbeat workflows
2. Created 7 per-agent heartbeat workflow files
3. Updated `agents/may/cron.json` — migrated 7 heartbeat cron entries from `type: "heartbeat"` to `type: "job"` + `handler: "run-workflow"`
4. All heartbeat sessions will now be tracked with `workflowRunId`

## Next Steps
- [ ] Route "Task Tree Evaluation" sessions through a workflow (would add ~399 sessions → ~95% coverage)
- [ ] Monitor first few heartbeat cycles for errors with new routing
- [ ] Archive or consolidate the shared `heartbeat.ts` once per-agent versions are proven stable
