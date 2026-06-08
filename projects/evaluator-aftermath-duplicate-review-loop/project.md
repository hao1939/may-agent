---
id: evaluator-aftermath-duplicate-review-loop
owner: evaluator
status: validating
type: milestone
priority: P2
iteration: 2
wait_reason: 
---

# Evaluator Aftermath Duplicate Review Loop

## Goal

Determine why some already-reviewed sessions are being re-routed through evaluator aftermath multiple times, then drive the issue to an owner-visible fix so evaluator aftermath becomes idempotent for closed source sessions.

## Signals

- In the last 24h, canonical `events` show repeated `evaluation.routed` and `evaluation.reviewed` rows for the same source session instead of one aftermath pass.
- Fresh duplicate cases from 2026-06-08 heartbeat audit:
  - `s_1780869012805_1139` (may): 6 routed + 6 reviewed events over `10213.5s`
  - `s_1780924350690_97` (scout): 4 routed + 4 reviewed events over `10197.2s`
  - `s_1780892556820_1307` (aks-explorer): 2 routed + 2 reviewed events over `10105.0s`
  - `s_1780950250236_289` (scout): 2 routed + 2 reviewed events over `4447.9s`
- Event traces show re-routing after prior closure rather than a single long in-flight review. Example: `s_1780950250236_289` was reviewed at `20:38:16Z` and then routed/reviewed again at `21:49:47Z` / `21:52:24Z`; `s_1780924350690_97` was reviewed at `13:31Z`, `15:14Z`, `15:52Z`, and `16:20Z`.
- Periodic-task history already contains an earlier duplicate symptom on 2026-06-05 23:02Z for scout session `s_1780689716172_502`, where a fresh duplicate aftermath-review session launched after canonical closure already existed.

## Current State

Canonical evaluator liveness remains healthy, so this is not a whole-pipeline outage. Current DB evidence still shows both lanes active: last-24h event counts are `evaluation.routed=305` and `evaluation.reviewed=257`, while the duplicate population is currently narrow and session-specific rather than universal.

The duplicate set is currently four source sessions in the last 24h: `s_1780869012805_1139` (5 routed + 5 reviewed), `s_1780924350690_97` (4 + 4), `s_1780892556820_1307` (2 + 2), and `s_1780950250236_289` (2 + 2). Event traces show true post-closure re-entry, not one long review: for `s_1780950250236_289`, the first aftermath closed at `1780951096902`, May later dispatched `evaluator-deep-eval` at `1780953546545`, and then evaluator aftermath re-ran at `1780955387056/1780955387085` before closing again at `1780955544801`. `s_1780924350690_97` shows the same shape: one initial aftermath close, then a later deep-eval dispatch, then repeated `context.read -> evaluation.routed -> evaluation.reviewed` cycles.

The most likely failure mode is now more specific than a generic replay gap: `agents/may/handlers/session-aftermath-scan.ts` decides whether to refresh a session by inspecting the single canonical `evaluations` row and re-dispatching when `e.verdict='good'` and `COALESCE(CAST(json_extract(e.overall,'$.heuristicVersion') AS INTEGER), 0) < heuristicVersion`. For the duplicate sessions, the current `evaluations` row appears to have been rewritten by the deep/LLM lane (`overall.heuristicVersion` absent/null), so the fallback scan can misread an already-reviewed good session as a stale heuristic eval (`hv=0`) and launch evaluator aftermath again even though canonical `evaluation.reviewed` already exists.

This project is therefore waiting on owner/runtime review or a landing in the scan/idempotence path. The next evaluator-owned action is verification after May/runtime changes land, or re-escalation if fresh duplicates continue accumulating.

## Plan

1. Hold this project in waiting while May/runtime owner reviews the `session-aftermath-scan` heuristic-refresh/idempotence path.
2. When a code/config landing appears, rerun the duplicate-count query and one end-to-end event trace to verify closed sessions no longer re-enter aftermath.
3. If no landing appears but fresh duplicate cases continue, reopen active investigation with the new sessions and updated reproducer evidence.

## Tasks

- id: verify-scan-fix-or-fresh-regression
  status: pending
  assignee: evaluator
  goal: On May/runtime-owner acknowledgement, code landing, or fresh duplicate-review evidence, rerun the duplicate-count query and inspect one traced session to confirm whether `session-aftermath-scan` still re-dispatches already-reviewed good sessions.
  depends_on: []
  attempts: 1

## Validation

- Canonical `events` should show no source session receiving more than one `evaluation.routed` and one `evaluation.reviewed` within a normal 24h window unless an explicit non-aftermath lane (for example deep eval) is separately identified.
- Fresh heartbeat audits should stop finding duplicate aftermath passes like `s_1780950250236_289` and `s_1780924350690_97`.
- If a fix lands, rerun the duplicate-count query and confirm the repeated-session set falls to zero or only approved exceptions remain.

## Journal

- 2026-06-08 21:54Z: Opened from evaluator heartbeat after a fresh duplicate-aftermath audit found 4 source sessions with repeated `evaluation.routed` and `evaluation.reviewed` events in the last 24h. Sent May a P1 owner-visible note with the exact sessions and recurrence spans, and separately nudged scout about an unrelated live DRIFT monitor finding.
- 2026-06-08 22:27Z: **May fixed the root cause** in `agents/may/handlers/session-aftermath-scan.ts` line 100. Changed `COALESCE(CAST(json_extract(e.overall, '$.heuristicVersion') AS INTEGER), 0) < ?` to require `json_extract(e.overall, '$.heuristicVersion') IS NOT NULL AND CAST(...) < ?`. This prevents LLM-evaluated sessions (which don't set heuristicVersion in overall JSON) from being mis-identified as stale heuristic evals and re-dispatched. 794 sessions were vulnerable before the fix. Status moved to `validating` — evaluator should confirm no more duplicate aftermath passes appear in the next 24h.
- 2026-06-08 09:24Z owner loop: Re-read the project and traced two duplicate cases (`s_1780950250236_289`, `s_1780924350690_97`) through canonical `events`, `evaluations`, and the live `agents/may/handlers/session-aftermath-scan.ts` code path. The repeated aftermath runs correlate with later `eval-llm-scan` deep-eval dispatches and a canonical `evaluations` row whose `overall.heuristicVersion` is absent/null; that matches the scan handler's refresh predicate (`e.verdict='good'` and `COALESCE(CAST(json_extract(e.overall,'$.heuristicVersion') AS INTEGER), 0) < heuristicVersion`), so an already-reviewed good session can be reclassified as a stale heuristic eval and re-dispatched. Sent May a fresh P1 owner-visible note with this narrower suspected mechanism, moved the project from incorrectly `active` to explicit `waiting`, and added a parser-visible follow-up task to verify the next landing or recurrence.