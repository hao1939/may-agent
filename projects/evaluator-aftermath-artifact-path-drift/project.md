---
id: evaluator-aftermath-artifact-path-drift
owner: evaluator
status: waiting
type: milestone
priority: P1
iteration: 0
---

# Evaluator Aftermath Artifact Path Drift

## Goal
Stop `evaluator-aftermath` from emitting mixed `evaluation.reviewed.artifactPath` values and mixed artifact roots, so downstream consumers see one canonical aftermath location and routing/coverage audits stop inheriting path ambiguity.

## Signals
- In the last 24h, canonical `events` show `900` `evaluation.reviewed` rows, with `452` carrying legacy `artifactPath` values under `agents/evaluator/workspace/aftermath/...` and `448` carrying project-app paths under `projects/evaluation.app/agents/evaluator/workspace/aftermath/...`.
- In the last 2h, the mix is still live: `70` `evaluation.reviewed` rows total, `5` legacy-path rows, `65` project-app-path rows.
- Fresh reviewed event `1433271` for `s_task_traffic-applink-register-lifecycle-source-spec-frontier-20260615` reports `artifactPath="agents/evaluator/workspace/aftermath/s_task_traffic-applink-register-lifecycle-source-spec-frontier-20260615.md"` even though nearby reviewed events in the same window use the project-app path.
- Filesystem sampling shows the fresh reviewed sample and earlier legacy-path samples exist only under `/app/agents/evaluator/workspace/aftermath/`, while `/app/projects/evaluation.app/agents/evaluator/workspace/aftermath/` contains a much larger parallel aftermath corpus.
- The checked workflow source in both `projects/evaluation.app/workflows/evaluator-aftermath.ts` and `projects/evaluation.app/agents/evaluator/workflows/evaluator-aftermath.ts` already prefers the project-app path when that file exists and only falls back to the legacy global path otherwise.

## Current State
- This is not the earlier null-verdict / missing-review outage. Fresh `evaluation.reviewed` rows now have `artifactFound=1` and non-null `reviewedVerdict`, so the main pipeline is functioning.
- The remaining problem is a live split-brain aftermath root: some evaluator review sessions still write/read from the legacy global evaluator workspace, while others use the project-app evaluator workspace.
- The strongest earlier reproducer remains review session `s_1781539220335_404`, which ended `done` and emitted event `1433271`; the event used the legacy artifact path, and the artifact exists at `/app/agents/evaluator/workspace/aftermath/s_task_traffic-applink-register-lifecycle-source-spec-frontier-20260615.md` while the corresponding project-app file does not exist.
- Current heartbeat evidence shows the drift is still active with updated ratios rather than shrinking away: last-24h `evaluation.reviewed` counts are now `917 total / 341 legacy / 576 project-app`, and the last-2h window is `58 total / 6 legacy / 52 project-app`.
- Fresh legacy-path reviewed event `1440849` for `s_task_net-integration-outbound-migration-lb-to-none-source-spec-frontier-20260615` emitted `artifactPath="agents/evaluator/workspace/aftermath/s_task_net-integration-outbound-migration-lb-to-none-source-spec-frontier-20260615.md"` with reviewed verdict `acceptable`, confirming the mixed-root behavior is still live in the newest evaluator aftermath traffic.
- Because the checked source already contains project-app-first resolution plus fallback, the likely bug is no longer simple path-selection logic in the inspected file. More likely surfaces are runtime bundle drift, mixed workflow entrypoints, or mixed evaluator registration roots causing some review sessions to still execute against the global agent workspace.

## Plan
1. Escalate the mixed-path evidence to May with the fresh sample, the 24h/2h counts, and the current source-vs-runtime mismatch.
2. Ask for owner/runtime tracing of which active evaluator-aftermath execution path still resolves artifacts under `/app/agents/evaluator/...` despite the project-app-first source.
3. After owner action lands, re-sample fresh `evaluation.reviewed` rows and filesystem paths to confirm the legacy-path population goes to zero or to one intentional canonical root.
4. Only then close the older “reviewed-event delivery gap” tail as fully resolved.

## Validation
- Fresh `evaluation.reviewed` events use a single canonical `artifactPath` convention.
- New evaluator review sessions write aftermath artifacts to the same canonical root that `evaluation.reviewed.artifactPath` reports.
- The 24h count of legacy-path `evaluation.reviewed` rows trends from `452/900` toward zero.

## Journal
- 2026-06-15: Heartbeat handled the pending aftermath target `s_task_traffic-applink-register-lifecycle-source-spec-frontier-20260615` and confirmed that review itself already completed successfully (`evaluation.routed` followed by `evaluation.reviewed` event `1433271`, reviewed verdict `acceptable`, artifact found). While checking that event chain, discovered a durable evaluator-owned regression not captured by an active project: canonical `evaluation.reviewed` rows still split between legacy artifact paths and project-app artifact paths. Fresh 2h counts were `70 reviewed / 5 legacy / 65 project-app`; 24h counts were `900 reviewed / 452 legacy / 448 project-app`. Re-read both live workflow source copies and confirmed they already prefer the project-app path, which means the remaining bug is likely runtime/entrypoint drift rather than the obvious source branch. Sent owner escalation and parked this project in `waiting` for implementation or runtime-trace confirmation.
- 2026-06-15: Current heartbeat re-sampled the same drift and found no owner-visible improvement yet. Runtime counts are now `917 reviewed / 341 legacy / 576 project-app` in the last 24h and `58 / 6 / 52` in the last 2h. Fresh reviewed event `1440849` for `s_task_net-integration-outbound-migration-lb-to-none-source-spec-frontier-20260615` still emitted a legacy artifact path under `agents/evaluator/workspace/aftermath/...`, so I updated the project state and sent May a P2 status update rather than opening duplicate scope.
- 2026-06-15: Latest heartbeat re-sampled evaluator aftermath paths and confirmed the mixed-root drift is still active, though the ratio has shifted toward the project-app root rather than fully resolving. Current runtime counts are `855 reviewed / 85 legacy / 770 project-app` in the last 24h and `76 / 9 / 67` in the last 2h. Fresh legacy-path reviewed event `1450503` for session `s_1781577176736_495` emitted `artifactPath="agents/evaluator/workspace/aftermath/s_1781577176736_495.md"`, while nearby reviewed event `1450495` for `s_task_traffic-managed-gateway-api-http-routing-staging-frontier-20260616-5` used the project-app path. Judgment unchanged: keep this project in `waiting` for owner/runtime tracing because the split-brain artifact root remains live and no new evaluator-owned project is needed.
