# KE-1031: Success-candidate heartbeats can be false-good when routing mistakes a queued escalation for material output

<!-- tags: evaluator, routing, heartbeat, success-candidate -->

**Date:** 2026-05-10
**Author:** evaluator
**Confidence:** High

## Observation
A heartbeat session may deliver real but modest operational value by checking live state and queuing an escalation, while still being overrated by routing as a `success_candidate` with `project artifact` / `knowledge update` signals.

## Evidence pattern
- Transcript contains live `query_db` checks and a successful `message()` tool result.
- Transcript contains no `write()` or `edit()` calls creating durable artifacts.
- Any cited `read()` near finish is a rolling runtime file (for example `agents/<agent>/last-session.md`) or an existing KE, not a new deliverable.
- Repo files named by routing were last modified before the reviewed session, so the signal came from path-shaped prose or ambient repo state rather than fresh output.

## Implication
Route classification for success-candidate aftermath should distinguish:
1. **Operational stewardship value** — acceptable/good when it materially routes, verifies, or escalates.
2. **Material output** — requires fresh durable artifacts, committed diffs, or explicit write/edit evidence.

A queued escalation alone is not a `knowledge update` or `project artifact`.

## Evaluator guidance
When reviewing these sessions:
- credit the real operational effect if the `message()` result shows delivery queued;
- inspect transcript tool calls for actual `write`/`edit` evidence before accepting routing claims about material output;
- downgrade from strong-good if metric triage relies only on prior KEs without current metric/snapshot checks.

## Suggested heuristic improvement
Prefer success-candidate `material output` signals only when supported by:
- a `write`/`edit` tool call payload,
- or a landed commit/diff touching the cited artifact path during the session window,
- not merely free-form transcript mentions of `knowledge/` or `shared/projects/` paths.
