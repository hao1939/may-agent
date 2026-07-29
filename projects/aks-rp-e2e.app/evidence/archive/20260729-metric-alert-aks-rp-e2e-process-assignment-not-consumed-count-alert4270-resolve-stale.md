# Metric alert triage — resolve_stale — `aks-rp-e2e.process.assignment.not-consumed-count`

- Alert id: `4270`
- Metric id: `aks-rp-e2e.process.assignment.not-consumed-count`
- Judged at: `2026-07-29T16:09:43Z`
- Chosen operation: `resolve_stale`

## Judgment

Choose `resolve_stale` because the alert payload was already stale by the time of owner judgment. The prompt captured a breaching sample (`current=2`), but the live source of truth had already recovered: a fresh owner-side recompute returned `value=0`, the runtime later persisted `metrics.current=0`, and alert `4270` gained a non-null `resolved_at` with a matching `metric.recovered` event.

## Evidence checked

### 1. The prompt snapshot reflected a transient breach

Recent persisted history showed the breach began at:

- snapshot `measured_at = 1785349269467`
- `value = 2`
- assignments:
  - `domain/repair-serverless-dns-from-aci-shared-fixture-compaction-a3664d9e4`
  - `domain/verify-serverless-aci-shared-fixture-live-and-reconcile-dns-after-dev-integration-6a87a4e7a`

### 2. Fresh owner-side recompute was already healthy

Direct metric recompute from the registered source command returned:

```json
{"measuredAt":1785349554133,"treePath":"/app/projects/aks-rp-e2e.app/.state/tasks/tree.json","value":0,"sampleSize":0,"note":"{\"assignments\":[]}"}
```

That proved there was no live queued-assignment backlog left to fix.

### 3. Runtime persisted recovery shortly after

Current runtime metric row now shows:

- `current = 0`
- `updated_at = 1785349823357`
- `priority = P0`
- `status = active`

Latest persisted snapshots now show healthy consecutive samples:

- `1785349797007` → `value=0`, `sample_size=0`, `note={"assignments":[]}`
- `1785349628043` → `value=0`, `sample_size=0`, `note={"assignments":[]}`
- `1785349570278` → `value=0`, `sample_size=0`, `note={"assignments":[]}`

### 4. The alert row already auto-resolved

Runtime `metric_alerts` row for alert `4270` now shows:

- `resolved_at = 1785349578055`
- `created_at = 1785349289281`

Matching recovery event:

- `events.id = 4602650`
- `event_type = metric.recovered`
- `timestamp = 1785349578095`
- `source = agent:may`
- `metricId = aks-rp-e2e.process.assignment.not-consumed-count`
- `alertId = 4270`
- `current = 0`

## Why this is `resolve_stale`

There is no remaining live breach, no wrong threshold to calibrate, and no safe root-cause repair left to apply. The only issue in the prompt was timing: it described an earlier transient state that the runtime had already healed and closed through normal metric lifecycle handling.

## Next validation signal

Validate on the next `metrics-snapshot` cycle. Expected result:

- `aks-rp-e2e.process.assignment.not-consumed-count` stays at `0`
- snapshot notes continue to show `{"assignments":[]}`
- no new open alert row appears unless a future assignment again outlives the worker-start grace window
