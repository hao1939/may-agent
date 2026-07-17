# Repair publication-holder successor retargeting — 2026-07-16

## Task
- Task id: `ops/repair-publication-holder-successor-retargeting-20260716`
- Reproducer lineage: `spec.egress-lockdown.windows-baseline`

## Baseline reproducer facts
1. `tasks/tree.json` showed the original publication holder `domain/publish-egress-lockdown-windows-baseline-review-visible-20260716` was closed as replaced because it still pointed at missing wait `wait-egress-lockdown-windows-baseline-ado-run-172480751-result` after successor wait `wait-egress-lockdown-windows-baseline-ado-run-172493879-result` existed.
2. The live successor publication holder that app-ops created manually at `domain/publish-egress-lockdown-windows-baseline-review-visible-rerun-172493879-20260716` still had `blocker.waiting_for.taskId` pointing to itself, proving the task tree had no structural field linking publication holders to the actual governing wait.
3. In `workflows/project-planner.ts`, the accepted-review path `createAcceptedQueuedPipelineWait(...)` created the successor ADO wait, populated its blocker/trace, and returned. It did not inspect or retarget any existing review-gated publication holders.

## Root cause
The missed retarget happened in the planner accepted-review path, not in watchdog harvesting.

When an accepted repair queued a successor same-spec ADO rerun, `createAcceptedQueuedPipelineWait(...)` created the new wait task but left existing review-gated publication holders untouched. Because those holders were only textually tied to the old wait and had no structured `governingWaitTaskId`, the app had no deterministic successor linkage and stale holders kept pointing at superseded ids until a manual repair replaced them.

## Patch
Updated `workflows/project-planner.ts` to:
- detect blocked review-gated publication holders;
- match same-lineage holders by source task id, stored publication-gate metadata, spec ids, feature token, and publication-holder text;
- retarget matched holders when `createAcceptedQueuedPipelineWait(...)` creates a successor wait;
- rewrite holder acceptance/blocker text to the new wait id;
- add structured `blocker.waiting_for.governingWaitTaskId`, `runId`, `runUrl`, `specIds`, and `sourceTaskId` metadata so later planner/metrics/readout code can follow the governing wait without text scraping;
- record retarget metadata in holder context/trace and in the tool journal.

Added a focused regression test in `workflows/project-planner.test.ts` that reproduces the stale egress-lockdown publication holder and proves an accepted successor rerun now retargets the holder automatically.

## Verification
### Baseline before change
```bash
cd /app/projects/aks-rp-e2e.app && bun test ./workflows/project-planner.test.ts --timeout 30000
```
Result before the patch: `99 pass, 0 fail`.

### Post-change verification
```bash
cd /app/projects/aks-rp-e2e.app && bun x prettier --check workflows/project-planner.ts workflows/project-planner.test.ts && bun test ./workflows/project-planner.test.ts --timeout 30000
```
Result after the patch:
- Prettier check: `All matched files use Prettier code style!`
- Planner tests: `100 pass, 0 fail`

### Focused regression proof
The new test `accepted queued rerun retargets stale review-gated publication holders to the successor wait` verifies that after the planner creates `wait-egress-lockdown-windows-baseline-ado-run-172493879-result`, the stale holder:
- stays blocked instead of being orphaned,
- updates acceptance/blocker text from run `172480751` to successor wait `172493879`,
- records `blocker.waiting_for.governingWaitTaskId = wait-egress-lockdown-windows-baseline-ado-run-172493879-result`, and
- stores the structured publication-gate metadata in task context.

## Files changed
- `workflows/project-planner.ts`
- `workflows/project-planner.test.ts`
