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

## 2026-05-21 recurrence: classifier-level false positives

A later dev heartbeat (`s_1779340820626_3`) produced a useful committed investigation update, but evaluator aftermath again emitted `[high] project_context/stale-blocker-loop` with `projectId: null`. The session itself was classified `success_candidate` and the evaluator's own review artifact (`agents/evaluator/workspace/aftermath/s_1779340820626_3.md`) judged it **Good**.

Additional DB evidence shows this is not isolated: in the last 24h, `learning.feedback` rows with `finding.id='stale-blocker-loop'` appeared for `aks-explorer` (23), `scout` (23), `may` (19), and `dev` (13). The recent feedback rows still carry `projectId: null`, so the suggested action "update project context" is structurally unavailable.

Code inspection of `agents/evaluator/workflows/evaluator-aftermath.ts` found the likely classifier cause: `buildOwnerFindings()` calls `hasBlockedLoopSignal(joinedEvidence)` across the whole transcript/heuristic/route text and emits `stale-blocker-loop` without requiring a non-null `projectId`, a blocked/waiting session status, or a project-context target. This lets words like "stale blocker" inside heartbeat prompts, prior feedback, or investigation artifacts become high-severity project-context findings even for successful null-project heartbeats.

Updated judgment: continue dismissing dev-owned null-project stale-blocker-loop feedback as non-actionable for project context, but track this as an evaluator-aftershock classifier issue. A durable fix should gate `stale-blocker-loop` owner findings on concrete project context (`projectId` present or blocked/waiting project status) and/or line-scoped blocked-loop evidence, not arbitrary full-transcript text matches.
