# Workflow Audit — Iteration 16

**Date:** 2026-04-19  
**Milestone:** Audit existing workflows — categorize keep/archive/investigate adoption

## Coverage Measurement

**Sample:** Last 200 sessions from `.state/sessions/history/`  
**Workflow-routed:** 173 (86.5%)  
**Freestyle:** 27 (13.5%)

### Freestyle Breakdown
| Count | Agent | Source | Pattern |
|-------|-------|--------|---------|
| 19 | evaluator | (internal) | Task tree evaluations — auto-triggered, not agent work |
| 6 | tech-lead | agents.fork | Forked tasks from other agents (implement, investigate, fix) |
| 1 | coder | (internal) | Forked coding task |
| 1 | coach | cron | Cron-triggered task |

## Workflow Inventory

### Per-Agent Heartbeat Workflows (KEEP — actively used)
All 7 are registered in `cron.json` with `handler: "run-workflow"`:

| Workflow | Agent | File | Status |
|----------|-------|------|--------|
| may-heartbeat | may | agents/may/workflows/may-heartbeat.ts | ✅ Active in cron |
| bob-heartbeat | bob | agents/bob/workflows/bob-heartbeat.ts | ✅ Active in cron |
| coach-heartbeat | coach | agents/coach/workflows/coach-heartbeat.ts | ✅ Active in cron |
| optimizer-heartbeat | optimizer | agents/optimizer/workflows/optimizer-heartbeat.ts | ✅ Active in cron |
| scout-heartbeat | scout | agents/scout/workflows/scout-heartbeat.ts | ✅ Active in cron |
| tech-lead-heartbeat | tech-lead | agents/tech-lead/workflows/tech-lead-heartbeat.ts | ✅ Active in cron |
| qa-heartbeat | qa | agents/qa/workflows/qa-heartbeat.ts | ✅ Active in cron |

### Shared/Utility Workflows (KEEP)
| Workflow | File | Used By |
|----------|------|---------|
| persistent-task | agents/shared/workflows/persistent-task.ts | project-resume cron |
| verify-wrap | agents/shared/workflows/verify-wrap.ts | optimize, reflect, common-sense-verify, common-sense-infra, research-intake cron jobs |
| implement-and-verify | agents/shared/workflows/implement-and-verify.ts | Agent-callable |
| implement-and-review | agents/shared/workflows/implement-and-review.ts | Agent-callable |
| parallel-research | agents/shared/workflows/parallel-research.ts | Agent-callable |
| agent-heartbeat (factory) | agents/shared/workflows/agent-heartbeat.ts | Base for all per-agent heartbeats |
| heartbeat (generic) | agents/shared/workflows/heartbeat.ts | Fallback — may be archivable |

### Specialized Workflows (KEEP)
| Workflow | File | Used By |
|----------|------|---------|
| training-sprint | agents/coach/workflows/training-sprint.ts | training-sprint cron |
| growth-cycle | agents/coach/workflows/growth-cycle.ts | Coach-callable |
| safe-edit | agents/optimizer/workflows/safe-edit.ts | Optimizer-callable |
| design-review | agents/optimizer/workflows/design-review.ts | Optimizer-callable |
| investigate-and-fix | agents/optimizer/workflows/investigate-and-fix.ts | Optimizer-callable |
| enhance-cron | agents/optimizer/workflows/enhance-cron.ts | Optimizer-callable |
| verified-coder | agents/tech-lead/workflows/verified-coder.ts | Tech-lead-callable |
| lens-analysis | agents/tech-lead/workflows/lens-analysis.ts | Tech-lead-callable |
| vet-skill | agents/qa/workflows/vet-skill.ts | QA-callable |
| project-monitor | agents/may/workflows/project-monitor.ts | May-callable |

### Sensor-Judge Workflows (KEEP)
| Workflow | Cron Job | Description |
|----------|----------|-------------|
| error-scan | error-scan | JS sensor + LLM judge for error patterns |
| coaching-feedback | coaching-feedback-wf | JS sensor + LLM judge for convention violations |

### Investigate for Archive
| Workflow | Reason |
|----------|--------|
| heartbeat (generic) | Superseded by per-agent heartbeats. Check if anything still references it. |

## Key Finding

**Coverage is already at 86.5%**, exceeding the 80% target. The per-agent heartbeat workflows from iteration 15 are correctly registered in cron.json and actively routing sessions through workflows.

The remaining 13.5% freestyle sessions are:
- **Evaluator sessions (70% of freestyle):** These are internal evaluation tasks, not regular agent work. Could be wrapped in a workflow but low priority.
- **Forked tasks (22% of freestyle):** When agents fork work to other agents via `agents.fork`, the child session is freestyle. This is the main adoption gap for agent-initiated work.
- **Misc cron (7%):** Rare edge cases.

## Recommendations
1. ✅ Mark milestone 1 "Audit existing workflows" as complete
2. The generic `heartbeat.ts` can be archived once confirmed nothing references it
3. For further coverage gains, forked agent tasks could use `workflow.run()` instead of freestyle `agents.fork`
