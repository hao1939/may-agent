# Design: Retry Budget Guard for Repeated Task Dispatches

**Date**: 2025-05-03
**Author**: Bob
**Status**: Proposed
**Priority**: P1 — prevents multi-day compute waste

## Problem

Evidence from system_status shows 45+ interrupted sessions repeating 3 tasks over ~2 weeks (April 21-22 era). "Ship EXP-188" alone had 20+ interrupted attempts. Total waste: ~4 hours of compute, plus queue pollution blocking useful work.

Root cause: heartbeat dispatch loops re-spawn tasks that keep getting interrupted, with no backoff or retry limit.

## Proposed Solution: Retry Budget Guard

### Mechanism

Before dispatching any forked task, check the request tracking DB for recent attempts at the same task (fuzzy match on task description).

```
IF same-task interrupted 3+ times in last 24h:
  → DON'T re-dispatch
  → Log warning: "Task exceeded retry budget"
  → Escalate to agent's next heartbeat as a BLOCKER (not a silent re-fork)
```

### Implementation Options

**Option A: Agent-side guard (in heartbeat instructions)**
- Add to heartbeat.md: "Before forking, check `agents requests --filter active` for similar tasks. If 3+ recent failures, escalate instead."
- Pro: No code changes. Con: Relies on agent compliance.

**Option B: Infrastructure guard (in fork handler)**
- Add pre-fork check in the session dispatcher that queries request DB for duplicates with `interrupted` status.
- Pro: Enforced automatically. Con: Requires may/infra code change.

**Option C: Hybrid — tracking file + agent check**
- Maintain `.state/retry-tracker.json` with task hashes and attempt counts.
- Agents check before forking; infrastructure updates on interrupt.
- Pro: Visible, debuggable. Con: File coordination complexity.

### Recommended: Option B (infrastructure guard)

The problem is fundamentally a dispatch-loop issue. Agent-side guards (Option A) failed historically — agents don't reliably self-check. Infrastructure enforcement is the only reliable path.

### Key Parameters
- **Window**: 24 hours
- **Max retries**: 3 (then escalate)
- **Match threshold**: Task description similarity > 0.8 (or exact prefix match on first 50 chars)
- **Backoff**: After 1st interrupt, wait 2x normal interval. After 2nd, wait 4x.
- **Escalation**: Convert to a `blocker` entry in the agent's next heartbeat inbox.

## Success Criteria

1. No task is forked more than 3 times without human/escalation review
2. Zombie session count drops to <5 per week (from 45+ in the epidemic period)
3. No false positives blocking legitimate retries of different-but-similar tasks

## Connection to Existing Work

- `request-deduplication` project exists but only prevents *concurrent* duplicates, not *serial re-dispatch after interrupts*
- EXP-188 finish-guard: the irony — a guard experiment that itself became a zombie task
- KE findings on "SOUL.md ≠ judgment fix" support Option B (structural > instructional)

## Next Steps

1. Check if may's fork handler has a hook point for pre-dispatch checks
2. Prototype the retry tracker as a simple JSON file first (Option C as stepping stone)
3. Measure current interrupt-then-redispatch rate to establish baseline
