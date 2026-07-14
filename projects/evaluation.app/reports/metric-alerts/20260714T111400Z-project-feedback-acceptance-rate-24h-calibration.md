# Metric alert triage — evaluator.project-feedback-acceptance-rate-24h

- Alert id: `3649`
- Metric: `evaluator.project-feedback-acceptance-rate-24h`
- Chosen operation: `calibrate_metric`
- Decision time: `2026-07-14T11:14:00Z`

## Judgment

This alert is a **measurement semantics bug**, not a real owner-acceptance failure.
The metric name and design doc say it measures whether evaluation project-health
feedback was **accepted by target owners**, but the current implementation counts
only `status='handled'` on `project.planning.requested` events.

In the current 24h cohort, all evaluation feedback requests already have
`accepted_at` populated, while only 18/47 were later marked `handled`.
That makes the live 0.383 value a false breach for an acceptance metric.

## Evidence checked

### 1) Metric intent

- `projects/may-agent.app/docs/2a-design/metrics.md` defines
  `evaluator.project-feedback-acceptance-rate-24h` as the "share of evaluation
  project-health feedback accepted by target owners".

### 2) Runtime cohort facts

Read-only DB query over the current 24h cohort of
`events.event_type='project.planning.requested'`, `source='evaluation.app'`,
`json_extract(data,'$.reason')='evaluation-project-health-feedback'`:

- total rows: `47`
- rows with `accepted_at IS NOT NULL`: `47`
- rows with `status='handled'`: `18`
- rows with `status='pending'`: `29`
- acceptance rate by `accepted_at`: `1.000`
- rate by `status='handled'`: `0.383`

Per-owner split in the same cohort:

- `project:evaluation`: `17/17` accepted, `0/17` handled
- `project:aks-rp-e2e`: `12/12` accepted, `0/12` handled
- `project:scout-knowledge-lib`: `10/10` accepted, `10/10` handled
- `project:may-agent`: `8/8` accepted, `8/8` handled

### 3) Current implementation mismatch

`/app/agents/may/handlers/metrics-snapshot.ts` currently computes the metric by
counting feedback rows where `status = 'handled'`, not where `accepted_at` is
present.

## Requested calibration

Update the metric implementation so that `evaluator.project-feedback-acceptance-rate-24h`
uses owner acceptance semantics instead of task completion semantics:

- preferred: count rows with `accepted_at IS NOT NULL`
- acceptable fallback: rename the metric to a handled/completed-rate metric if
  the product intent is actually completion rather than acceptance

Because this session only has read-only DB access and cannot safely edit the
runtime metric row, the calibration request was escalated to `may` with this
artifact.

## Expected validation

On the next metrics snapshot after the implementation is corrected, the metric
should move from `0.383` to approximately `1.000` for the current 24h cohort,
and alert `3649` should recover without needing owner-behavior changes.
