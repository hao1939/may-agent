# Coaching Dispatcher — Implementation & First Run

## What Was Built

**File**: `agents/may/handlers/coaching-dispatcher.ts`

A handler that closes the coaching loop by:
1. Scanning `.state/coaching-queue/` for pending coaching entries
2. Generating tailored coaching messages based on trigger type
3. Writing coaching guidance to the flagged agent's `knowledge/` directory
4. Moving processed entries to `.state/coaching-queue/processed/`
5. Logging all dispatches to `.state/coaching-dispatch-log/`

## Trigger → Message Mapping

| Trigger | Priority | Coaching Focus |
|---------|----------|----------------|
| `quality_critical` | P0 | Review output quality, consider escalation |
| `no_result_delivered` | P0 | Always produce partial deliverables |
| `repeated_low_quality` | P1 | Systemic issues, task selection |
| `efficiency_low` | P2 | Planning before executing, batching |

## First Run Results

```
Dispatched 1 coaching messages:
  → optimizer: [P0] Critical quality issue detected (P0)
```

**Processed**: `optimizer_1777484873037.json` → moved to `processed/`
**Output**: `agents/optimizer/knowledge/coaching-1777484997843.md` with specific improvement guidance
**Log**: `.state/coaching-dispatch-log/dispatch-1777484997844.json`

## The Complete Pipeline Is Now Closed

```
eval-poller (30min) → session-eval → evaluations/
     ↓
coaching-consumer (30min) → coaching-queue/
     ↓
coaching-dispatcher (6h) → agent knowledge/ + processed/
```

The optimizer agent will now see the coaching file in its next session's context, completing the learning flywheel: **eval → score → flag → coach → improve**.
