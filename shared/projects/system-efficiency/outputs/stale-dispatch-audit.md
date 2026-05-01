# Stale Dispatch Audit

Generated: 2026-04-29

## Summary

Cross-referenced project references found in agent code/config against actual directories in `/app/agents/shared/projects/`.

**Actual project directories (18):** _archive, agent-convention-compliance, agent-memory-learning, agent-system-literacy, coach-quality, documentation-gen, evaluation-revival, gym-quality-improvement, handler-reliability, hao-alignment, metric-system.md, outputs, proof-of-life-dashboard, request-deduplication, skill-workflow-audit, system-efficiency, test-coverage, workflow-reliability

## Stale References (referenced but don't exist as directories)

| Referenced Path | Status |
|---|---|
| projects/adaptive-heartbeats | ❌ Not found |
| projects/adaptive-reasoning-efficiency | ❌ Not found |
| projects/pwi-evaluator-tuning | ❌ Not found |
| projects/context-learning | ❌ Not found |
| projects/gym-scenario-expansion | ❌ Not found |
| projects/system-evolution | ❌ Not found |
| projects/metric-reactivity | ❌ Not found |
| projects/feedback-loop | ❌ Not found |
| projects/harness-engineering-long-running-agents | ❌ Not found |
| projects/superpowers-composable-skills | ❌ Not found |
| projects/zombie-manifest | ❌ Not found |

## Fix Applied

`master-worker.ts` line 222-224 now returns `{ status: "skipped", reason: "project-not-found" }` instead of escalating, preventing wasted iterations on non-existent projects.

## Remediation Status

### Code Fix (DONE ✅)
`master-worker.ts` line 222-224 now gracefully skips non-existent projects instead of escalating. This eliminates the error cascade.

### Source of Stale Dispatches
Investigation found that stale project references exist in:
- **Journal/workspace files** (32+ files across scout.bak, arc, optimizer, bob) — historical mentions, not dispatch triggers
- **Gym scenarios** (e.g., `heartbeat-project-creation/scenario.json`) — test fixtures, not production dispatch

**Key finding**: There is NO centralized project registry or config file that triggers dispatch. Projects are dispatched by agents passing a string like `"project: agents/shared/projects/X"` to the master-worker workflow. The stale dispatches come from agents that have outdated project names in their context/memory.

### Remaining Actions
| Action | Impact | Status |
|---|---|---|
| master-worker.ts skip fix | Prevents error escalation for all stale dispatches | ✅ Done |
| Remove scout.bak references | Cleanup only (scout.bak is inactive) | ⚠️ Low priority |
| Agent context cleanup | Agents may still attempt dispatch, but it now returns cleanly | ⚠️ Low priority — code fix handles it |

### Conclusion
The code fix is the correct solution. Stale references in agent memory/journals are harmless now that `master-worker.ts` gracefully skips missing projects. No config file edits are needed — the references are in unstructured text, not dispatch configs.
