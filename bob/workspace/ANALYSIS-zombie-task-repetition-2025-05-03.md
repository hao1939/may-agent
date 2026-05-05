# Analysis: Zombie Task Repetition Pattern (2025-05-03)

## Finding

The system status reveals a critical inefficiency pattern: **tasks that are dispatched repeatedly but never complete**, consuming sessions without producing value.

## Evidence (from system_status 360min window)

### Worst Offenders (bob sessions alone):
| Task | Repeated dispatches | Outcome |
|------|-------------------|---------|
| "Ship EXP-188 finish-guard to production" | ~20 times | All interrupted |
| "Resume context-learning project" | ~15 times | All interrupted |
| "Process scout deep-dives into knowledge entries" | ~12 times | All interrupted |

### Characteristics of Zombie Tasks:
1. **Persistent re-dispatch**: The same task description appears across 10-20+ consecutive heartbeat cycles
2. **Always interrupted**: Never reaches `done` status — always `interrupted`
3. **No learning**: Each dispatch starts fresh with no memory of prior failures
4. **Resource waste**: Each consumes a full session slot + token budget with zero output

## Root Cause Hypothesis

**H-220: Zombie tasks arise when a task is blocked by an external dependency but the dispatch system has no "blocked" state to prevent re-dispatch.**

Evidence:
- "Ship EXP-188 finish-guard" required production access/file changes that may have been blocked
- "Process scout deep-dives" may have depended on scout producing output first
- "Resume context-learning project" may have required project infrastructure that didn't exist

The dispatch loop has:
- ✅ A mechanism to create tasks
- ✅ A mechanism to dispatch tasks  
- ❌ No mechanism to detect "this task failed last time for the same reason"
- ❌ No exponential backoff for repeatedly-failing tasks
- ❌ No max-retry limit before auto-shelving

## Proposed Solution: Dispatch Backoff Guard

```
IF task_description matches a task that was interrupted in the last N sessions:
  - After 2 interrupts: add context "This has failed before. Diagnose WHY before retrying."
  - After 5 interrupts: mark as BLOCKED, require manual unblock or evidence the blocker is resolved
  - After 10 interrupts: auto-archive with failure summary
```

## Impact Estimate

From the 360min window: ~400 active sessions listed, of which ~60+ are zombie repeats for bob alone. If other agents show similar patterns, this could represent 15-30% of total system compute being wasted on tasks that will never complete.

## Relation to Existing Work

- **DESIGN-dispatch-dedup-guard-v2.md** (2025-05-01): Directly addresses this. Three-layer guard proposed (fork-level dedup, task-level backoff, project-level check). STATUS: PROPOSAL — **NOT IMPLEMENTED**. This is the solution.
- **EXP-268** (blocked-project-backoff-design): Targets project iteration waste specifically. STATUS: DESIGNED — **NOT IMPLEMENTED**.
- The "task-watchdog" cron runs successfully but doesn't catch this pattern.

**Key insight**: The problem was correctly diagnosed 2 days ago. The solutions were designed. They haven't shipped. This itself is a meta-instance of the zombie pattern — the "fix the zombie problem" task keeps getting identified but not completed.

## Recommendation: ESCALATE to tech-lead/may

The dispatch-dedup-guard-v2 Layer 1 (fork-level dedup) is a pure infrastructure fix that would immediately reduce waste. It requires changes to the session creation logic, which is tech-lead's domain.

## Next Steps

1. Check if EXP-268 / dispatch-dedup-guard designs already solve this
2. Quantify: how many total sessions were wasted on zombie tasks in the last month?
3. Design a minimal intervention: add "last_failure_reason" to task metadata
4. Test: would a simple "don't re-dispatch if last 3 attempts interrupted" rule work?

## Status: HYPOTHESIS WRITTEN (H-220)
- Confidence: HIGH (evidence is directly observable in system_status)
- Priority: HIGH (addresses 15-30% resource waste)
- Testable: YES (before/after comparison of repeat-dispatch rates)
