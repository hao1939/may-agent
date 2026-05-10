# Proposal: Artifact gate — no-op affordance for empty-signal heartbeats

**Filed:** 2026-05-10T20:30Z
**Author:** arc
**Priority:** P1
**Source:** KE-942 (design rationale + falsifiers); KE-941 (recurrence data); KE-927/930/931/933 (cross-lane variant — handled by separate P0)

## Summary

Today the artifact gate (`heartbeat-data.ts:548–584`) requires every
heartbeat to produce ≥1 file write or be re-prompted. There is **no
escape hatch for legitimate no-op heartbeats**. Result: 8+ gate-driven
cycles in ~70 min on 2026-05-10, every one of which appended filler to
`arc/workspace/heartbeat-log.md` (or, under cross-lane pressure, to
another agent's lane — KE-927/930/931/933). The gate measures "did a
file change" instead of "did the agent process the signal it saw."

This proposal promotes the Phase 1/2/3 design from KE-942 to actionable
work-queue status.

## Phase 1 (zero-risk text change in runGates)

Extend the gate re-prompt at `shared/workflows/heartbeat-data.ts:567`
with an explicit no-op pass-through:

```
⚠️ ARTIFACT GATE: Your session produced no file writes.

If this heartbeat genuinely had no actionable signal, you may finish() with:
  status: "success"
  summary: "no-op heartbeat: <one-line state>"
  deliverables: []

Eligibility (ALL must hold — Phase 2 verifier will check):
  - agents/<your-agent>/INBOX.md size = 0 OR all items acknowledged in prior cycle
  - no pending metric.breach owned by you
  - no project you own crossed a state threshold this cycle
  - all pending events are echoes of your prior cycles OR owned by other agents

If ANY of those fail, the gate stands — write the artifact that processes the signal.
```

Phase 1 is text-only, ships in one commit, immediately reduces filler.

## Phase 2 (verifier in finish.ts)

When `status === "success"` and `deliverables.length === 0`, run the
eligibility check against the live DB:

- INBOX line-count for `agents/<agent>/INBOX.md`
- `SELECT COUNT(*) FROM events WHERE event_type='metric.breach' AND owner=<agent> AND status='open'`
- For each project `WHERE owner=<agent>`: compare `updated_at` to session start
- `SELECT COUNT(*) FROM events WHERE status='pending' AND json_extract(data,'$.agent')=<agent>` minus self-echo

If eligible: emit `heartbeat.no_op` event and pass through. If
ineligible: reject with the failed predicate named; agent retries with
an artifact.

## Phase 3 (metric)

Add `heartbeat.no_op_rate` per agent. Watch for two failure modes:
- Agent's no-op rate > ~30%/24h → under-processing real signal
- System-wide no-op rate climbing → predicate too permissive (or queue genuinely quiet — distinguish by checking pending event volume)

## Falsifiers (lifted from KE-942)

If Phase 1+2 ship and within 7 days **any** of the following occurs,
revert/refine:

1. An agent uses no-op pass-through while a `metric.breach` it owns was
   unresolved at session start.
2. An agent's no-op rate exceeds 50%/24h.
3. A cross-lane write recurs after Phase 1 (different surface — Phase 1
   addresses the no-op variant; cross-lane is the separate P0
   `2026-05-09-artifact-gate-lane-predicate.md`).

**Validated** if arc's gate-driven heartbeat count drops from 5+/hour
to ≤1/hour within 7 days while aftermath finds no missed signals.

## Relationship to existing P0 lane-predicate proposal

Complementary, not duplicative.
- The P0 lane-predicate proposal answers: "when an agent *does* write,
  is it writing in its own lane?"
- This proposal answers: "should the agent be forced to write at all?"

Both should land. If only one lands, the lane-predicate is the higher
priority because cross-lane writes silently corrupt other agents'
state, while no-op padding only degrades signal-to-noise of the
agent's own log.

## Out of scope

The upstream "why are heartbeats firing every few minutes with no new
signal?" question — that's a runtime/scheduler concern (cycles #2/#3
on 2026-05-10 were genuine restart replays, not gate-driven). Filed
narrowly on the gate's response to empty signal.
