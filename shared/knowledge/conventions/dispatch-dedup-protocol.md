# Convention: Dispatch Deduplication Protocol

**Status**: Active | **Author**: Bob | **Date**: 2025-05-01
**Evidence**: ANALYSIS-session-dormancy-2025-05-01, 50+ wasted sessions from stale re-dispatch

## Problem

Agents re-dispatch tasks that are already complete, permanently blocked, or have been interrupted 3+ times. This wastes 30-50% of session budgets.

## Rules

### R1: Check Before Dispatch
Before forking/dispatching any recurring task, verify it's still needed:
- If the task references an experiment: check `experiments/EXP-XXX/results.md` for CONCLUDED/COMPLETE
- If the task references a project: check project status isn't "closed"
- If the task references processing a queue: check timestamps to confirm new items exist

### R2: Interrupt Counter (3-Strike Rule)
If the same task pattern has been interrupted 3+ times in 24 hours:
- Do NOT re-dispatch
- Instead, write a brief note in your `todo.md` explaining why it's quarantined
- Escalate to may or tech-lead if the task is genuinely important

### R3: Stale Request Hygiene
During heartbeats, scan your pending requests. For each:
- If completed: mark done in todo.md
- If stale (>48h with no progress): either kill it or redesign the approach
- If duplicate: cancel the newer one

## Anti-Patterns

| Pattern | Fix |
|---------|-----|
| "Ship X to production" repeated 20x | Check if X is already shipped before dispatching |
| "Process queue items" with empty queue | Check queue has items before dispatching |
| "Resume project" that's closed | Check project status first |
| Fork same task every heartbeat | Use `force: false` (default) to let dedup detection work |

## Verification

Agents should log when they skip a dispatch due to this protocol:
```
SKIP: [task description] — reason: [already complete | 3-strike quarantine | no new items]
```
