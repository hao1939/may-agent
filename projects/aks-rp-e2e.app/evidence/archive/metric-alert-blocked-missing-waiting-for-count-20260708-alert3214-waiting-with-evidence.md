# Metric alert triage — aks-rp-e2e.process.blocked.missing-waiting-for-count (alert 3214)

- Metric id: `aks-rp-e2e.process.blocked.missing-waiting-for-count`
- Alert id: `3214`
- Chosen operation: `waiting_with_evidence`
- Time: `2026-07-09T18:00Z`

## Judgment

The breach was initially real: the runtime metric snapshot named one blocked leaf offender, `hold-compact-fleet-hubless-rpapi-version-progression-frontier-20260709`.

I applied the supported task-tree repair path:

```bash
cd /app/projects/aks-rp-e2e.app && bun run ./scripts/task-tree.ts repair-blocked-contracts
```

That repair mutated the runtime tree and reported:

```json
{
  "repairedCount": 1,
  "repaired": [
    "hold-compact-fleet-hubless-rpapi-version-progression-frontier-20260709"
  ]
}
```

The repaired blocked task now carries a structured `blocker.waiting_for` object in `.state/tasks/tree.json`:

```json
"waiting_for": {
  "type": "environment.available",
  "taskId": "hold-compact-fleet-hubless-rpapi-version-progression-frontier-20260709",
  "sourceRunId": "28621132999"
}
```

A direct runtime-tree audit after the repair found **zero** blocked leaves missing `waiting_for`.

## Why this is `waiting_with_evidence`

The supported repair changed the offending blocked task, but the metric sampler still immediately reported `value=1` for the same task id even after the repaired runtime tree clearly contains `blocker.waiting_for`.

So the current state is:

1. The named runtime offender was repaired.
2. The runtime tree now shows the required field.
3. A direct blocked-leaf recompute returns zero offenders.
4. The official metric script still reports `1` for the same task id.

That contradiction means the safest truthful disposition is to leave the alert in **waiting_with_evidence** until the next metric validation signal (`metrics-snapshot`) proves recovery or reproduces the contradiction again, at which point the sampler path itself should be treated as the next exact repair target.

## Next validation

- Wait for the next `metrics-snapshot` / `metric.recovered` signal for `aks-rp-e2e.process.blocked.missing-waiting-for-count`.
- If the next supported sample still reports `1`, open the metric sampler implementation as the exact follow-up repair target because the runtime tree evidence is already compliant.
