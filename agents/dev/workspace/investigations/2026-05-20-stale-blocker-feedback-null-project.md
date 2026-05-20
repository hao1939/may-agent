# Stale-blocker feedback with null project context

Date: 2026-05-20
Owner: dev

## Signal

A `learning.feedback` inbox event for dev reported `[high] project_context/stale-blocker-loop` on session `s_1779295235605_25` and suggested updating project context with a newer blocker/resume condition.

## Evidence

Read-only DB triage this heartbeat found:

- `learning.feedback` row owner `agent:dev`, source `evaluator-aftermath`, sessionId `s_1779295235605_25`, `projectId: null`.
- Current dev-owned projects are all closed: `empty-assistant-stop-runtime-retry`, `finish-blocked-hygiene-reduction`, and `eval-llm-lane-restoration`.
- Dev health metrics remain green: `session.error-rate-6h=0.0119`, `handler.success-rate=0.9953`, and finish-blocked metrics both `0`.

## Judgment

No dev project file should be updated from this feedback because the feedback does not name a project and the dev-owned project set has no active/blocked project context. Treating this as a project update would create noise and risk re-opening closed work without a concrete resume trigger.

## Follow-up trigger

If this feedback recurs with a non-null `projectId`, or if a dev-owned project becomes active/blocked with the same stale-blocker pattern, update that project with the latest blocker evidence and a concrete resume condition.
