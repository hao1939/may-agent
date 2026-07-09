# Metric alert triage — `aks-rp-e2e.process.blocked.missing-observer-count` — alert `3220`

- Judged at: `2026-07-09T18:00:05Z`
- Chosen operation: `waiting_with_evidence`
- Metric owner: `app-ops`

## Judgment

The persisted metric row and open alert still show a breach (`current=1`, threshold `0`), but the current authoritative live recompute is already healthy. A fresh direct metric sample now returns `value=0` with no offender task ids, and the task named in the most recent snapshot (`wait-spec-secops-fips-upgrade-survival-ado171478411-return-20260709`) already carries the required blocked observer contract fields (`observed_by`, `observation_method`, and `next_check_at`). In this triage environment there is no safe runtime write path to clear the stale metric/alert state directly, so the correct owner action is `waiting_with_evidence` until the next metrics refresh reconciles persisted state with the already-healthy runtime tree.

## Evidence checked

### 1. Persisted metric row is still breaching

Read-only DB query against `metrics` returned:

- `id = aks-rp-e2e.process.blocked.missing-observer-count`
- `current = 1`
- `threshold = 0`
- `target = 0`
- `priority = P0`
- `updated_at = 1783558210068`
- `source_command = bun /app/projects/aks-rp-e2e.app/scripts/project-metrics.ts aks-rp-e2e.process.blocked.missing-observer-count --json`

### 2. The latest fresh live sample is healthy

Command:

```bash
cd /app/projects/aks-rp-e2e.app && bun run metrics:sample aks-rp-e2e.process.blocked.missing-observer-count --json
```

Observed result:

```json
{"measuredAt":1783558381064,"treePath":"/app/projects/aks-rp-e2e.app/.state/tasks/tree.json","value":0,"sampleSize":0,"note":"{\"offenderTaskIds\":[]}"}
```

So the current runtime tree used by the supported metric sampler has no blocked tasks missing observer metadata.

### 3. The task named in the latest stale snapshot already has observer fields

Command:

```bash
cd /app/projects/aks-rp-e2e.app && bun run task-tree show wait-spec-secops-fips-upgrade-survival-ado171478411-return-20260709
```

Observed blocked contract fields on that task:

- `blocker.next_check_at = 2026-07-09T08:45:00Z`
- `blocker.observed_by.workflow = project-planner`
- `blocker.observed_by.schedule = blocked-frontier-app-ops-review`
- `blocker.observation_method = Scheduled blocked-frontier app-ops review checks the stated wait condition and must unblock, replace, escalate, or keep the wait with fresh evidence.`
- `trace.blocked_contract_repaired_at = 2026-07-09T00:51:54.262Z`

That means the specific task called out by the recent metric snapshot is no longer missing observer metadata.

### 4. Metric contract still correctly measures missing observer fields

`projects/aks-rp-e2e.app/scripts/project-metrics.ts` defines this metric as:

```ts
"aks-rp-e2e.process.blocked.missing-observer-count": () => ({
  value: tasks.blockedMissingObserver,
  sampleSize: tasks.blockedMissingObserverTaskIds.length,
  note: JSON.stringify({
    offenderTaskIds: tasks.blockedMissingObserverTaskIds,
  }),
}),
```

So the measurement rule itself is still aligned with the process contract: it should alert only when blocked tasks actually lack observer metadata.

## Conclusion

`waiting_with_evidence` is the correct final operation because the current live runtime tree is already healthy, there is no current blocked-holder observer defect to repair safely in this session, and this environment does not provide a safe runtime write path to clear the stale persisted metric/alert state directly.

## Next validation

Validate on the next `metrics-snapshot` / alert refresh cycle for `aks-rp-e2e.process.blocked.missing-observer-count`. Recovery is confirmed when the persisted `metrics.current` row updates from `1` to `0` and alert `3220` resolves automatically. If a future fresh sample returns `>0`, reopen only with the concrete offender task ids from that sample.
