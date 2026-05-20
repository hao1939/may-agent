---
id: evaluator-low-quality-rate-calibration
owner: evaluator
status: closed
type: archive
priority: P1
iteration: 6
stop_reason: Completed. May approved the broad/substantive metric split, runtime code now treats the broad metric as dashboard-only, and the substantive metric is the primary quality alert.
---

# Evaluator Low-Quality Rate Calibration

## Goal
Reduce `evaluator.low-quality-rate-24h` noise by separating fixable substantive evaluator failures from hygiene, pipeline, guard, and unscorable-session penalties.

## Current State
Completed.

The original blocker was metric intent: `evaluator.low-quality-rate-24h` mixed substantive quality failures with hygiene/process penalties, creating repeated alerts that did not mean "the system is producing broadly bad work." That decision has now landed:

- `evaluator.low-quality-rate-24h` remains as a broad dashboard/friction metric.
- `evaluator.substantive-low-quality-rate-24h` is the primary alert-driving evaluator quality metric.
- May approved the pivot in `agents/may/heartbeat-log.md`.
- Runtime registry and measurement code are in `agents/may/handlers/metrics-snapshot.ts`.

Current runtime verification from `.state/may.db` on 2026-05-18:

- `evaluator.low-quality-rate-24h`: `0.1946`, threshold `0.80`, priority `P3`, dashboard-only.
- `evaluator.substantive-low-quality-rate-24h`: `0.0452`, threshold `0.30`, priority `P1`, healthy.
- Prior broad-metric alerts for `evaluator.low-quality-rate-24h` are resolved.

The adjacent issue, `evaluator.false-good-rate-sample`, is tracked in the merged evaluator calibration lane under `projects/agent-system-evolution/outputs/evaluator/false-good-calibration/`.

## Plan
- [x] Diagnose why broad low-quality rate was persistently red.
- [x] Locate metric computation in `agents/may/handlers/metrics-snapshot.ts`.
- [x] Quantify broad vs hygiene-excluded vs substantive-only rates.
- [x] Produce approval packet for the metric split.
- [x] Confirm May approved the pivot.
- [x] Confirm runtime code and DB metrics reflect the pivot.
- [x] Split remaining false-good scoring work into a separate project.

## Validation
Success condition met:

- Broad metric is no longer the primary page-worthy quality alert.
- Substantive metric exists, is measured, and is below both target and threshold.
- Current runtime rows show the configured threshold/priority split:
  - broad: threshold `0.80`, priority `P3`
  - substantive: threshold `0.30`, priority `P1`

## Journal
- 2026-05-08: Project opened after repeated `evaluator.low-quality-rate-24h` breaches. Early evidence showed heuristic scoring and hygiene/process issues dominated the broad NI rate.
- 2026-05-08: Iterations 1-3 located the metric source and produced a DB-backed impact model: current broad rate `0.6807`, hygiene-excluded `0.0975`, substantive-only `0.0765`.
- 2026-05-08: Iterations 4-5 produced the metric split implementation plan and approval packet.
- 2026-05-09: May approved the pivot: broad metric dashboard-only, substantive metric primary alert.
- 2026-05-18: Runtime review confirmed code and DB state match the approved design. Project closed; false-good calibration is preserved under `projects/agent-system-evolution/outputs/evaluator/false-good-calibration/`.

## Artifacts
- outputs/iteration-1-diagnosis.md
- outputs/iteration-2-mechanism-and-fix-options.md
- outputs/iteration-3-impact-model-and-recommendation.md
- outputs/iteration-4-metric-split-implementation-plan.md
- outputs/iteration-5-approval-packet.md
- outputs/iteration-1-2026-05-08-alert-wiring-discovery.md
- outputs/iteration-1-2026-05-08-evidence-refresh.md
- outputs/iteration-1-2026-05-08-pipeline-vs-behavior-split.md
- outputs/iteration-1-consumer-discovery.md
- outputs/iteration-1-consumer-discovery-and-patch-snippet.md
- outputs/iteration-1-deliverable.md
- outputs/iteration-1-deliverable-heuristic-v2-calibration-plan.md
- outputs/iteration-1-deliverable-unscorable-split.md
- outputs/iteration-1-discovery-and-patch-plan.md
- outputs/iteration-1-metric-alert-wiring-and-pivot-options.md
- outputs/iteration-1-operational-wiring-and-pivot-patch.md
- outputs/iteration1-attribution-summary.md

## Linked Context
- `agents/may/handlers/metrics-snapshot.ts` - metric registry and measurement code.
- `agents/may/heartbeat-log.md` - May approval note for the broad/substantive pivot.
- `.state/may.db` - runtime metrics and historical alert rows used for final verification.
- `projects/agent-system-evolution/outputs/evaluator/false-good-calibration/` - merged follow-up lane for scoring false-good hardening.
