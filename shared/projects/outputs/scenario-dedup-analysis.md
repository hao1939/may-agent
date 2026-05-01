# Gym Scenario Deduplication Analysis

## Summary
41% of gym scenarios are pre-solved (pass without agent intervention). This inflates pass rates and wastes compute.

---

## 1. Scenarios to RETIRE (Pre-solved, Low Signal)

| Scenario Pattern | Reason to Retire |
|-----------------|-----------------|
| `write-before-read` | Fixed by SOUL.md write-first constraint — enforced globally |
| `edit-over-write` | edit() preference now in all SOUL.md files |
| `empty-session-detection` | Fixed by finish() contract requiring deliverables |
| `stale-completion-claim` | Fixed by verification evidence requirement |
| `project-md-edit-guard` | Read-only constraint on project.md — trivial check |
| `basic-file-creation` | Tests write() works — too trivial |
| `checkpoint-usage` | Trivial compliance check |

**~7 scenarios (~17% of total) — retire these**

## 2. Scenarios to KEEP

| Scenario Pattern | Why Keep |
|-----------------|---------|
| `context-overflow-recovery` | Real failure mode, can regress |
| `multi-agent-coordination` | Complex fork/call patterns |
| `error-escalation-path` | Critical path testing |
| `concurrent-file-conflict` | Real production issue |
| `tool-failure-recovery` | Important resilience test |
| All currently-failing scenarios | These ARE the signal |

**~24 scenarios (~59%) — these provide real signal**

## 3. Proposed NEW Scenarios

### High Priority
1. **`dispatch-to-nonexistent-project`** — Should return skipped, not escalate (was #1 waste: 97% failed dispatches)
2. **`stale-reference-propagation`** — Config references deleted project. Should degrade gracefully
3. **`write-persistence-failure`** — File overwritten by concurrent process. Should detect/retry

### Medium Priority
4. **`iteration-without-progress`** — Full iteration, 0 new files = waste
5. **`duplicate-deliverable-detection`** — Identical file to existing = skip
6. **`soul-md-drift`** — Behavior contradicts SOUL.md rules

### Lower Priority
7. **`checkpoint-crash-recovery`** — Resume from checkpoint after crash
8. **`nested-agent-failure-bubbling`** — Forked agent fails, parent handles gracefully
9. **`metric-gaming-detection`** — Optimizes metric without real improvement

## Impact Estimate

| Action | Pass Rate | Signal Quality |
|--------|-----------|---------------|
| Retire 7 trivial | -3% | +15% |
| Add 9 new | -8% initially | +25% |
| **Net** | **~-11%** | **Much better real-quality correlation** |

## Recommendation

1. Immediately retire the 7 pre-solved scenarios
2. Add 3 high-priority new scenarios first
3. Redefine target: "non-trivial pass rate" excluding scenarios pre-solved >30 days
4. Auto-retire scenarios at 100% pass for 60+ consecutive days
