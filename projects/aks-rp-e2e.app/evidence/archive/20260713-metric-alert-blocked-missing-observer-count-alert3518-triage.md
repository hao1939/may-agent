# Metric alert triage — `aks-rp-e2e.process.blocked.missing-observer-count` — alert `3518`

- Judged at: `2026-07-13T09:37:59Z`
- Metric id: `aks-rp-e2e.process.blocked.missing-observer-count`
- Alert id: `3518`
- Worker task: `ops/review-metric-alert-blocked-missing-observer-stale-vs-live-20260713`

## Result

Alert `3518` is stale relative to the current controller-visible live task tree.

The persisted metric row and breach event were produced from a sample at `2026-07-13T09:32:54.977Z` / breach event `2026-07-13T09:32:59.796Z` that still counted one offender: `hold-compact-fleet-reviewed-exception-split-frontier-20260709`. That holder was then repaired in the live runtime tree at `2026-07-13T09:34:07.329Z`, and a fresh supported live metric sample at `2026-07-13T09:37:59.782Z` returned `0` offenders from `.state/tasks/tree.json`.

No new blocked task currently lacks `blocker.observed_by`, `blocker.observation_method`, or `blocker.next_check_at` in the live tree.

## Baseline and contributor sets

Per the audit rule, the baseline excludes this audit task itself and reflects the pre-audit contributing blocked wait set.

### Pre-audit contributor set

Persisted `metric_snapshots` row for the breaching sample:

- snapshot id: `1257631`
- measured_at: `2026-07-13T09:32:54.977Z`
- value: `1`
- note: `{"offenderTaskIds":["hold-compact-fleet-reviewed-exception-split-frontier-20260709"]}`

So the pre-audit contributor set was exactly:

- `hold-compact-fleet-reviewed-exception-split-frontier-20260709`

### Post-action represented set

Fresh live sample and direct live-tree audit both show no represented offenders:

- `[]`

The sets differ because the live Fleet holder contract was repaired after the breaching sample but before this triage completed.

## Evidence checked

### 1. Persisted metric row / open alert still show the stale breach

`metrics` row:

- `current = 1`
- `target = 0`
- `threshold = 0`
- `updated_at = 1783935174977` (`2026-07-13T09:32:54.977Z`)
- `source_command = bun /app/projects/aks-rp-e2e.app/scripts/project-metrics.ts aks-rp-e2e.process.blocked.missing-observer-count --json`

`metric_alerts` row `3518`:

- `created_at = 1783935179796` (`2026-07-13T09:32:59.796Z`)
- `resolved_at = null`
- message: `AKS RP E2E blocked tasks missing observer is above threshold: current=1, threshold=0, target=0`

### 2. Persisted breaching snapshot named the exact prior offender

Latest breaching snapshot before triage:

```json
{
  "id": 1257631,
  "metric_id": "aks-rp-e2e.process.blocked.missing-observer-count",
  "value": 1,
  "sample_size": 1,
  "measured_at": 1783935174977,
  "measured_by": "agent:may",
  "note": "{\"offenderTaskIds\":[\"hold-compact-fleet-reviewed-exception-split-frontier-20260709\"]}"
}
```

Immediately preceding snapshots for the same metric were already `0`, showing this metric has been bouncing as contracts are repaired.

### 3. The named prior offender is repaired in the live runtime tree

Current `.state/tasks/tree.json` entry for `hold-compact-fleet-reviewed-exception-split-frontier-20260709` now contains:

```json
{
  "observed_by": {
    "workflow": "project-planner",
    "schedule": "blocked-frontier-app-ops-review",
    "trigger": "project.planning.requested"
  },
  "observation_method": "Scheduled blocked-frontier app-ops review checks the stated wait condition and must unblock, replace, escalate, or keep the wait with fresh evidence.",
  "next_check_at": "2026-07-13T20:00:00Z",
  "fallback_at": "2026-07-14T08:45:00Z"
}
```

And its trace records:

- `trace.blocked_contract_repaired_at = 2026-07-13T09:34:07.329Z`

That repair timestamp is later than the breaching sample time, which explains the stale alert.

### 4. Fresh supported live metric sample is healthy

Command run:

```bash
cd /app/projects/aks-rp-e2e.app && bun run ./scripts/project-metrics.ts aks-rp-e2e.process.blocked.missing-observer-count --json
```

Observed result:

```json
{"measuredAt":1783935479782,"treePath":"/app/projects/aks-rp-e2e.app/.state/tasks/tree.json","value":0,"sampleSize":0,"note":"{\"offenderTaskIds\":[]}"}
```

This is the authoritative current live sample because it explicitly sampled the controller-visible runtime tree path `.state/tasks/tree.json`.

### 5. Direct live runtime-tree audit also finds zero offenders

A direct audit over `.state/tasks/tree.json`, checking every blocked task for missing:

- `blocker.observed_by`
- `blocker.observation_method`
- `blocker.next_check_at`

returned:

```json
{
  "tree": ".state/tasks/tree.json",
  "count": 0,
  "missing": []
}
```

### 6. Non-live authoring tree still has one stale blocked-contract defect, but it is not the live metric source

A separate audit of `tasks/tree.json` returned one stale authoring-tree offender:

- `hold-compact-bootstrap-profile-byo-acr-reviewed-create-cache-acr0-frontier-20260711`

missing:

- `blocker.observed_by`
- `blocker.observation_method`

That explains why file-level searches can still find a missing-observer-shaped task in the repo copy, but it does **not** contradict the live result because the metric sample explicitly uses `.state/tasks/tree.json`, not `tasks/tree.json`.

## Diagnosis

This is the stale-alert path, not a current live blocked-wait hygiene defect.

- Pre-audit breaching contributor: `hold-compact-fleet-reviewed-exception-split-frontier-20260709`
- Live state now: repaired and fully observed
- Fresh live metric sample: `0`
- Fresh direct live-tree audit: `0`

Therefore the acceptance case is satisfied by proving alert `3518` stale relative to the current live tree.

## Exact next process action

Do **not** create a new blocked-frontier repair task for this metric.

Instead:

1. Leave the separate active Fleet holder review task (`ops/review-fleet-compact-holder-warning-and-wait-contract-20260713`) untouched; it addresses blocked-actionable/Fleet contract truth, not this now-cleared missing-observer breach.
2. Wait for the next persisted metric snapshot / alert recovery cycle to update `metrics.current` from `1` to `0` and resolve alert `3518` automatically.
3. If a future fresh live sample returns `>0`, reopen only with the exact offender task ids from `.state/tasks/tree.json` at that time.

## Planner note

If the planner needs a narrow follow-up, it should be tooling/watchdog validation only: confirm the recovery cycle consumes the repaired live sample and closes alert `3518`. No new blocked-holder repair work is justified from the current live tree evidence.

## Post-write persistence check

A follow-up persisted-metric check completed during this worker session and confirms the recovery cycle already caught up:

- `metrics.current = 0`
- `metrics.updated_at = 1783935497342`
- newest `metric_snapshots` row: `1257733`
- newest snapshot note: `{"offenderTaskIds":[]}`

So the stale-alert diagnosis held, and the persisted metric row is now healthy as well. The remaining planner action is simply to let alert `3518` resolve/close on the normal alert lifecycle rather than creating any repair task.