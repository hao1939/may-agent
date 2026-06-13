# Iter-13 — Arc decision: `project.health.checked`

**Iteration:** 13  
**Owner:** arc (judgment only)  
**Input:** `outputs/iter-13-investigation-findings.md`  
**Live re-check (2026-06-10):** Numbers replicate. `project.health.checked` 24h count = 2,850 (#4 by volume). All 37,367 rows are `pending`, `handled_by=NULL`. Emitter: `project-steward.ts:462`. Consumers: zero. `context.read` (also per falsifier contract) has grown from 156/day → 762/day, also all `pending`, zero consumers.

## Decision: **go — delete the emission.**

The investigation is unambiguous. `project.health.checked` is:

1. **A periodic snapshot** — every field is current-state, no old→new delta, no triggering condition. Same payload re-emitted every tick regardless of whether anything changed.
2. **Zero consumers** — no handler subscribes, no code queries for it, 37,367 rows sit unread at `pending`.
3. **Redundant** — the same handler loop already emits findings for detected conditions (actual transitions). The snapshot adds nothing the findings don't cover.
4. **Material cost** — 2,850 dead rows/day is 18x the `context.read` volume that iter-12 deferred as "rounding error."

This is the textbook case the adopted rule was meant to prevent: a periodic snapshot masquerading as an event in a transition stream. The iter-12 falsifier tripped because the discipline-without-enforcement approach failed — someone added exactly the pattern the rule forbids, within 25 days of adopting it.

## Falsifier contract: `context.read`

The iter-12 falsifier explicitly said: "re-open as a `go` on both the new emitter and `context.read`." `context.read` has grown 5x since iter-12 (156/day → 762/day), still with zero consumers (all 4,463 rows `pending`). The original `defer` rationale ("156 rows/day is rounding error") no longer holds.

**Recommendation:** address both in the experiment. Same fix class — remove a zero-consumer periodic emission.

## Experiment specification

**Scope:** Remove the `ctx.sdk.emit("project.health.checked", ...)` call from `agents/may/handlers/project-steward.ts:462`. Update the corresponding test (`project-steward.test.ts:175-176`). Verify findings emission is unaffected.

**`context.read` is a separate, smaller task** — investigate its emitter location and apply the same fix. Include in iter-13 experiment scope if the emitter is obvious and the change is ≤5 lines; otherwise split to iter-14.

**Reversibility:** Both changes are a revert-one-commit away.

**Success criterion:** After deployment, `project.health.checked` drops to 0/day in the next 24h top-15. Findings emission (the transition events from project-steward) continues unchanged.

## Strengthening the rule

The discipline adopted in iter-12 was passive ("new event_types must encode a transition"). It failed to prevent `project.health.checked` because no enforcement mechanism checks new emissions against the rule. However, adding a linter/gate is over-engineering for a codebase with 2-3 event_type additions per month. The right enforcement is the project-health checker itself — it already surfaces high-volume anomalies. The falsifier mechanism worked exactly as designed; the gap was latency (25 days). That's acceptable.

**Updated rule:** No change to the rule text. The enforcement mechanism is the existing project-health checker + this falsifier pattern. When the checker surfaces a new high-volume event_type, the learning loop reopens.
