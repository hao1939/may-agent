# Metric alert 3655 triage — fix_root_cause

Metric: `aks-rp-e2e.process.loop.unrepresented-record-count`
Alert: `3655`
Time: 2026-07-14T11:04Z

## Judgment

Choose `fix_root_cause`.

The alert was real, but the root cause was app-owned compact-frontier representation drift, not missing AKS domain work. The secops compact feature still had `status=blocked`, but its app-owned compact state pointed only at one shared capacity wait and carried no live `frontierTaskIds`, while the loop root still had `workflowProgress.unrepresentedNonTerminalFeatureKeys=["secops"]`. Current exact secops downstream waits already existed in the spec loop, but no compact-facing holder linked them back to `feature-compact:secops`, so the loop metric correctly saw one unrepresented non-terminal feature.

## Concrete repair applied

I applied a bounded app-owned runtime repair with:

```bash
cd /app/projects/aks-rp-e2e.app && bun run ./scripts/ops-apply-repair-secops-compact-frontier-representation-20260714.ts
```

The script used the supported task-tree / compact-state write paths and did all of the following:

1. created `hold-compact-secops-package-partial-frontier-20260714` under `aks-feature-compact-loop`
2. marked it as a compact exact wait holder with
   - `context.featureCompactExactWait=true`
   - `context.featureKey="secops"`
   - `context.compactFrontierTaskIds` naming the live exact downstream secops carriers
3. updated secops compact state so
   - `taskId` moved from `wait-secops-fips-automatic-managedsystem-capacity-family-return-20260702`
     to `hold-compact-secops-package-partial-frontier-20260714`
   - `frontierTaskIds` now names the exact current secops downstream carriers
4. repaired loop-root workflow progress so
   - `unrepresentedBlockedCount` became `0`
   - `unrepresentedNonTerminalCount` became `0`
   - `representedFeatureKeys` now includes `secops`

## Exact represented secops frontier now carried by the compact holder

- `wait-secops-fips-automatic-managedsystem-capacity-family-return-20260702`
- `wait-secops-identity-sp-workflow-secret-contract-return-20260704`
- `wait-secops-identity-user-assigned-row153-runtime-return-20260709`
- `wait-secops-identity-system-assigned-breadth-execute-approval-return-20260710`
- `hold-spec-secops-fips-exact-13spec-mixed-frontier-20260708`
- `wait-spec-secops-fips-terminal-artifact-visibility-family-return-20260708`
- `hold-spec-shared-authenticated-artifact-result-recovery-family-20260714`

This is the truthful compact-facing split frontier for secops right now.

## Before / after evidence

### Before repair

The repair script reported the pre-repair drift from live compact state:

- `beforeFeature.taskId = wait-secops-fips-automatic-managedsystem-capacity-family-return-20260702`
- `beforeFeature.frontierTaskIds = []`
- loop root still carried `unrepresentedNonTerminalCount = 1`
- loop root still carried `unrepresentedNonTerminalFeatureKeys = ["secops"]`

### After repair

The same script reported:

- `afterFeature.taskId = hold-compact-secops-package-partial-frontier-20260714`
- `afterFeature.frontierTaskIds =` the 7 exact task ids listed above
- `treeRepair.loopWorkflowProgress.unrepresentedBlockedCount = 0`
- `treeRepair.loopWorkflowProgress.unrepresentedNonTerminalCount = 0`
- `treeRepair.loopWorkflowProgress.representedFeatureKeys` now includes `secops`

## Validation

Direct recompute immediately after the repair returned a healthy metric sample:

```bash
cd /app/projects/aks-rp-e2e.app && \
  bun ./scripts/project-metrics.ts aks-rp-e2e.process.loop.unrepresented-record-count --json
```

Output:

```json
{"measuredAt":1784027055833,"treePath":"/app/projects/aks-rp-e2e.app/.state/tasks/tree.json","value":0,"sampleSize":0,"note":"{\"taskIds\":[],\"records\":[]}"}
```

## Why this is root-cause repair

The breach was not stale and was not a metric-threshold problem. The metric was correctly reporting one feature (`secops`) with no live compact-facing representation. The safe owner action was to restore truthful compact representation for that exact frontier. After that repair, the same metric source returned `value=0` immediately.

## Post-triage validation

Follow-up metric and alert state now show the repair landed all the way through the persisted runtime:

- `metrics.current = 0`
- `metrics.updated_at = 2026-07-14T11:05:32.840Z`
- alert `3655.resolved_at = 2026-07-14T11:05:38.250Z`

The follow-up audit memo at `evidence/archive/ops-repair-unrepresented-loop-record-integrity-drift-20260714.md` confirms there was no second live residue by the time the repair task started: the only remaining drift was snapshot lag between the bounded secops compact-holder repair and the next normal `metrics-snapshot` refresh.

Final alert judgment remains `fix_root_cause`: a real app-process representation defect existed, it was safely repaired through supported app-owned task-tree / compact-state mechanisms, and the persisted metric and alert lifecycle both recovered afterward.
