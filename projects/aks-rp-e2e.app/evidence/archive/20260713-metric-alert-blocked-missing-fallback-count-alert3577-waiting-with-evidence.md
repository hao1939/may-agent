# Metric alert triage — `aks-rp-e2e.process.blocked.missing-fallback-count` — alert `3577`

- Date: `2026-07-13`
- Final operation: `waiting_with_evidence`
- Metric id: `aks-rp-e2e.process.blocked.missing-fallback-count`
- Alert id: `3577`
- Persisted alert message at triage start: `AKS RP E2E blocked tasks missing fallback is above threshold: current=1, threshold=0, target=0`

## Judgment

This open alert is currently **persisted stale state waiting for the next metrics refresh, not a live blocked-holder defect that still needs mutation**.

At triage time, the runtime `metrics` row still showed `current=1` and alert `3577` remained open, but the current live metric source already recomputes to `0`, the supported blocked-contract repair dry run returns `repairedCount=0`, and the exact offender named in the latest persisted snapshot now carries both `blocker.fallback_at` and `blocker.fallback_action` in the live task tree.

That means there is no exact blocked-fallback repair left for me to apply safely in this session. The truthful final operation is `waiting_with_evidence`: durable evidence now records that the live authoritative task tree is healthy and the remaining discrepancy is the lagging persisted metric/alert lifecycle awaiting the next safe runtime metrics refresh.

## Evidence

### 1. Persisted runtime state is still breaching

Runtime DB reads at triage time showed:

- metric row: `current=1`, `threshold=0`, `target=0`, `priority=P0`, `updated_at=1783976897222`
- open alert row: `id=3577`, `resolved_at=null`
- latest persisted snapshot: `value=1`, `sample_size=1`, `measured_at=1783976897222`, `note={"offenderTaskIds":["ops/wait-project-approval-owner-return-primary-blocker-20260713"]}`

The immediately previous persisted snapshots were already healthy at `value=0`, confirming this is an isolated fresh breach in persisted state rather than a long-running trend.

### 2. Fresh live recompute already returns `0`

Command:

```bash
cd /app/projects/aks-rp-e2e.app && bun run scripts/project-metrics.ts aks-rp-e2e.process.blocked.missing-fallback-count --json
```

Output:

```json
{"measuredAt":1783977126690,"treePath":"/app/projects/aks-rp-e2e.app/.state/tasks/tree.json","value":0,"sampleSize":0,"note":"{\"offenderTaskIds\":[]}"}
```

So the current live metric source no longer finds any blocked leaves missing fallback metadata.

### 3. Supported repair path has nothing left to fix

Command:

```bash
cd /app/projects/aks-rp-e2e.app && bun run ./scripts/task-tree.ts repair-blocked-contracts --dry-run
```

Output excerpt:

```json
{
  "dryRun": true,
  "repairedCount": 0,
  "repaired": []
}
```

So there is no remaining blocked-holder fallback contract defect in the controller-authoritative runtime task tree.

### 4. The exact offending holder now shows full fallback metadata

Command:

```bash
cd /app/projects/aks-rp-e2e.app && bun run task-tree show ops/wait-project-approval-owner-return-primary-blocker-20260713
```

Relevant current `blocker` excerpt:

```json
{
  "next_check_at": "2026-07-14T00:40:00Z",
  "resume_condition": "Resume when a matching returned project.approval.submitted decision lands for one of the governed focus/shared-auth lineages, when reviewed same-lineage evidence replaces this family carrier, or when one of the sibling 2026-07-13T21:15:00Z owner-decision reviews returns a bounded decision that sharpens the governed branch set.",
  "fallback_at": "2026-07-14T06:04:00.656Z",
  "fallback_action": "If no bounded return lands by fallback, refresh this same exact family carrier against the latest reviewed evidence and keep dependent branches normalized behind it; do not recreate duplicate project-level review leaves or duplicate approval asks."
}
```

The same task also records:

- `trace.blocked_contract_repaired_at = 2026-07-13T12:58:03.352Z`
- `trace.blocked_wait_refreshed_at = 2026-07-13T21:10:11.255Z`
- `trace.blocked_wait_refreshed_by = task-tree-tool`

So the concrete root-cause repair already landed in runtime state before this triage concluded.

## Why this is `waiting_with_evidence`

- **Not `fix_root_cause`**: there is no live fallback-contract defect left to repair; live recompute is already `0` and repair dry run is a no-op.
- **Not `resolve_stale`**: this session has no safe runtime write path for manually resolving alert `3577` or rewriting the persisted metric row.
- **Not `upgrade_or_escalate`**: no destructive action or human policy decision is required; the remaining discrepancy should clear on the normal metrics refresh path.
- **Not `calibrate_metric`**: the metric still correctly measures blocked tasks missing fallback metadata.

## Concrete action taken by this session

This session recorded the judgment in this evidence file and accepted one exact wait condition for closure validation:

- **owner:** `app-ops`
- **wait target:** the next persisted `metrics-snapshot` / metric refresh for `aks-rp-e2e.process.blocked.missing-fallback-count`
- **check method:** confirm that persisted `metrics.current` drops to `0` and new snapshots stop naming `ops/wait-project-approval-owner-return-primary-blocker-20260713` in `offenderTaskIds`
- **fallback:** if the next persisted refresh still shows `>0`, re-triage from the then-current snapshot and task-tree evidence rather than assuming this same wait remains malformed

## Next validation

Validate on the next `metrics-snapshot` / alert refresh cycle. Recovery is confirmed when the persisted `metrics.current` value for `aks-rp-e2e.process.blocked.missing-fallback-count` updates from `1` to `0` and alert `3577` resolves automatically.