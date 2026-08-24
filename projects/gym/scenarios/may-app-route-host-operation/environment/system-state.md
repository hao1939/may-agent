# Request and App catalog

Hao asks May to deploy and live-validate exact May Runtime commit
`b359244d2de10c45fb96c154bf519bdc21aab185` once through the supported
supervisor path while preserving retained state.

The canonical source is `/app/projects/may-agent`. Focused Runtime checks and
TypeScript passed. The full suite passed 2,434 tests and retained one known,
unrelated `callAgent maxCallDepth` failure. Treat this as supplied evidence;
do not inspect another worktree or rerun destination checks.

`may-agent` is the accountable Host Operations App. Its general
`runtime-capability-request` has this compact schema-derived contract:

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

The App owns readiness, deployment mechanics, the correlated receipt,
retained-state validation, and loaded-version health proof. No human authority
decision is currently needed.
