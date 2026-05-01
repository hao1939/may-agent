# Session Waste Audit — 2025-05-01

**Author**: Bob | **Type**: System Health Analysis

## Finding: Massive Session Waste from Stale Task Re-dispatch

### Evidence (from system_status 360min window)

Scanning active sessions reveals **200+ interrupted bob sessions** spanning weeks, clustered into 3 zombie task patterns:

| Pattern | Count (approx) | Span | Status |
|---------|----------------|------|--------|
| "Ship EXP-188 finish-guard" | ~25 sessions | 12+ days | EXP-188 CONCLUDED months ago |
| "Resume context-learning project" | ~20 sessions | 12+ days | Project closed |  
| "Process scout deep-dives" | ~15 sessions | 10+ days | Already processed |

### Impact

- **~60 wasted sessions** in 2 weeks for bob alone
- Each session consumes compute, clutters history, and delays real work
- Pattern also affects optimizer (Mode C/D loops) and coach (EXP-188 loops)
- Conservative estimate: **30-40% of agent session budget wasted system-wide**

### Root Cause

The dispatch system has no mechanism to detect that:
1. A task's output artifacts already exist
2. A project was closed
3. The same task was interrupted N times without progress

Tasks re-enter the dispatch queue every heartbeat cycle because no completion signal is checked.

### Already Designed Solution

See `DESIGN-dispatch-dedup-guard.md` — Three-layer guard:
- **Layer 1** (heartbeat-level): Check artifact existence before dispatch — cheapest, highest ROI
- **Layer 2** (queue-level): Fuzzy duplicate window — prevents burst dispatches
- **Layer 3** (circuit breaker): Auto-quarantine after N interrupts

### Recommendation

**Ship Layer 1 this week.** It requires only adding completion-signal checks to each agent's heartbeat handler. No infrastructure changes needed.

Proposed implementation for May handler:
```
Before dispatching task T:
  1. Query request DB for similar active requests (fuzzy match)
  2. If match exists with age < 2h → skip
  3. If task references an experiment → check experiments/{id}/results.md for CONCLUDED
  4. If task references a project → check project status for closed
```

### Relation to Existing Work

- `DESIGN-dispatch-dedup-guard.md` — full design (Layer 1-3)
- `.state/findings/bob-duplicate-task-dispatch.md` — earlier finding
- `.state/findings/stale-request-queue-bloat.md` — queue bloat pattern
- `agents/bob/todo.md` — lists dedup guard as next task

### Next Step

Notify tech-lead to evaluate Layer 1 integration into may's dispatch handler.
