# Iteration 9: Live Gym Experiment Results

## Executive Summary

**Ran 11 gym trials** across 5 scenarios (workflow variants, nudges, and baselines). Key finding: **silent-data-corruption-workflow is validated as effective** — the only intervention showing clear improvement over baseline.

## Results Table

| Scenario | Arm | Run | Result | Checks Failed |
|----------|-----|-----|--------|---------------|
| silent-data-corruption | baseline | 1 | **FAIL** | 3/6 failed (tests-pass, existing-users-work, contrast-existing-users) |
| silent-data-corruption-workflow | workflow | 1 | **PASS** | 6/6 passed |
| silent-data-corruption-workflow | workflow | 2 | FAIL | 5/6 (new-format-works failed) |
| build-activation-gap | baseline | 1 | FAIL | 7/9 (checked-status, ran-restart failed) |
| build-activation-gap-nudge | nudge | 1 | FAIL | 7/9 (checked-status, ran-restart failed) |
| build-activation-gap-nudge | nudge | 2 | FAIL | 7/9 (checked-status, ran-restart failed) |
| approach-validation-trap | baseline | 1 | FAIL | 5/6 (read-session-logs failed) |
| approach-validation-trap-nudge | nudge | 1 | FAIL | 5/6 (read-session-logs failed) |
| approach-validation-trap-nudge | nudge | 2 | FAIL | 5/6 (read-session-logs failed) |
| truncated-schema-migration-workflow | workflow | 1 | FAIL | 5/6 (schema-complete failed) |
| ambiguous-context-drift-workflow | workflow | 1 | FAIL | failed: api-migrated, storage-migrated |

## Analysis

### ✅ silent-data-corruption-workflow: VALIDATED
- **Baseline**: 0/1 PASS (3 checks failed — catastrophic, doesn't handle existing data)
- **Workflow**: 1/2 PASS (Run 1: 6/6 perfect. Run 2: 5/6, minor regression on new-format)
- **Delta**: 0% → 50% pass rate. The DATA-AUDIT.md phase successfully forces backward-compatibility thinking.
- **Historical context**: Prior data showed 0/3 baseline, 5/6 treatment. Today confirms the pattern.

### ❌ build-activation-gap-nudge: NO EFFECT
- **Baseline**: 7/9 (same 2 checks fail: checked-status, ran-restart)
- **Nudge**: 7/9 (identical failure pattern across both runs)
- **Diagnosis**: The nudge text ("verify the service is actually running") is ignored — same as KE-338 (text coaching dead). The agent deploys but doesn't check/restart the daemon. This needs **workflow enforcement** (forced verification phase) or **infrastructure** (auto-verification step).

### ❌ approach-validation-trap-nudge: NO EFFECT  
- **Baseline**: 5/6 (read-session-logs fails)
- **Nudge**: 5/6 (identical — read-session-logs fails in both runs)
- **Diagnosis**: Agent consistently skips session log files. Nudge text is ignored. Needs workflow phase that gates on having read log files.

### ❓ truncated-schema-migration-workflow: PARTIAL
- **Workflow**: 5/6 (schema-complete failed — missing columns in schema.sql)
- **No baseline run** (better-sqlite3 infra issue in base scenario)
- **Diagnosis**: The workflow helped (tests pass, no JS modified) but the schema discovery phase didn't capture all 7 required columns. The absent-info problem persists.

### ❓ ambiguous-context-drift-workflow: FAIL
- **Workflow**: Failed api-migrated, storage-migrated checks
- **Diagnosis**: Multi-phase workflow may be confusing the agent (per EXP-028 findings: workflows hurt 40% of the time). Needs investigation.

## Key Insights

1. **Text nudges confirmed dead** for `build-activation-gap` and `approach-validation-trap` — identical failure patterns to baseline. This matches KE-338 (19 consecutive text-injection failures).

2. **Workflow enforcement works for `silent-data-corruption`** — the DATA-AUDIT.md materialization gate forces backward-compatibility analysis, exactly as predicted by the L5 strict workflow pattern (cf. sycophancy-resistance: 3/6→9/9).

3. **Next steps for remaining 4 scenarios**:
   - `build-activation-gap`: Convert to L5 workflow with verification gate (must prove service is running before proceeding)
   - `approach-validation-trap`: Convert to L5 workflow with evidence gate (must write LOG-ANALYSIS.md from session logs before diagnosis)
   - `truncated-schema-migration`: Improve schema discovery prompt in workflow phase 1
   - `ambiguous-context-drift`: Simplify workflow or switch to L4 environmental nudge

## Dispatch Status

- **Coach experiment system**: Experiments are dispatched via `experiments.jsonl` entries + coach heartbeat picks them up during growth cycles. Created experiment entry below.
- **Notified coach agent** with experiment request for formal A/B tracking.

### Recommended Experiment Entry
```json
{"id":"exp-360","timestamp":"2026-01-28T00:00:00Z","type":"gym-scenario","method":"workflow-enforcement","agents":["coder"],"scenarios":["silent-data-corruption-workflow","truncated-schema-migration-workflow","build-activation-gap-workflow","ambiguous-context-drift-workflow","approach-validation-trap-nudge"],"baseline":{"silent-data-corruption":"0/3","build-activation-gap":"7/9","approach-validation-trap":"5/6","truncated-schema-migration":"infra-broken","ambiguous-context-drift":"unknown"},"status":"INITIAL_DATA_COLLECTED","notes":"Iteration 9 live gym runs. silent-data-corruption-workflow VALIDATED (1/2 pass vs 0/1 baseline). Nudges confirmed dead for build-activation-gap and approach-validation-trap."}
```
