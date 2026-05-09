# Iter-12 — Arc decision on iter-11's `context.read` candidate

**Iteration:** 12
**Owner:** arc (judgment only; no code edits this iteration).
**Input:** `outputs/iter-11-subsystem-state-file-candidate-findings.md` §6.
**Live re-check (2026-05-09 hb):** `context.read` 24h count = 156 (was 155); reader grep returns the same two files (emitter `heartbeat-data.ts:501`, inspector `conformance-report.ts` x5 hits, all presence checks). Iter-11's numbers replicate.

## Decision: **defer (do not migrate yet).**

The candidate is genuine — `context.read` *is* a periodic snapshot whose payload no production reader consumes — and the migration is small and reversible, exactly as iter-11 §6 claims. But the value of doing the migration is also small: 156 rows/day is rounding error in `events`, and the inspector already works. The Ruflo lesson worth keeping is **the discipline** ("don't add periodic heartbeats to a transition stream"), not the cleanup of one borderline existing emitter. Migrating now spends a PR's worth of attention to delete ~150 rows/day; the same PR's worth of attention is better spent the next time someone proposes adding a *new* periodic-snapshot event_type, where the discipline prevents the second instance instead of cleaning up the first.

Concretely: the rule arc adopts from iter-11 is **"new event_types must encode a transition; periodic state belongs in a file or table the subsystem owns."** That rule is the durable take-away. The `context.read` row itself stays — it is honest enough as a "heartbeat reached the read stage" marker even if the inspector ignores its payload, and the cost of leaving it is a few hundred rows on the events table per week.

## Falsifier for this decision

If, within 30 days, **any new event_type lands in the top-15 by 24h volume whose payload is a periodic snapshot rather than a transition**, this `defer` was wrong (the discipline-without-migration choice failed to prevent the next instance), and iter-13 should re-open as a `go` on both the new emitter and `context.read`. Until then: no new artifact in this thread.

## Project-level implication

The Ruflo learning loop has now produced one durable rule (above) plus one closed thread (KE-902 / dispatch_waiting). Per the project charter ("adopt only the smallest ideas that improve may-agent's autonomous closed loop without adding unnecessary orchestration complexity"), that is a successful outcome for the loop, not a failure. **Recommend marking the project `paused` after iter-12** with the falsifier above as the resume trigger, rather than churning a thirteenth iteration to find another candidate. Iter-13 reopens automatically if the falsifier trips; otherwise the loop has converged and further iterations risk the iter-2 anti-pattern (meta-bookkeeping doom loop).
