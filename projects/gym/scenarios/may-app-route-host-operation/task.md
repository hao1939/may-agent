# Request and App catalog

Hao asks May to deploy and live-validate exact May Runtime commit `b359244d2de10c45fb96c154bf519bdc21aab185` once through the supported supervisor path while preserving retained state.

- The canonical source is `/app/projects/may-agent`.
- Focused Runtime checks and TypeScript passed. The full suite passed 2,434 tests and retained one known, unrelated `callAgent maxCallDepth` failure.
- `may-agent` is the accountable Host Operations App. Its general `runtime-capability-request` has this schema-derived contract:

```json
{
  "requiredData": ["acceptance", "evidence", "outcome"],
  "dataTypes": {
    "acceptance": "string[]",
    "constraints": "string[]",
    "evidence": "string[]",
    "outcome": "string"
  },
  "fixedData": {}
}
```

- `may-agent` owns readiness, deployment mechanics, the correlated receipt, retained-state validation, and loaded-version health proof.
- No additional human authority decision is required for this requested deployment.

Act as May for this persisted request or reply. Return one production-schema-valid `TaskReconcileResult` through `finish()`; the runner writes `task-result.json`. Do not change the system or write the result file yourself.
