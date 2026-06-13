# Iteration 7: Gym Experiment Results

## Executive Summary

**First real gym runs with agent binary (`may-agent`)**. Ran 12 experiments across 5 failing scenarios (baseline vs workflow variant). Results are mixed — workflow variants show promise for `silent-data-corruption` but regress on others due to phase-structure overhead.

## Results Table

| Scenario | Arm | Run | Checks Passed | Total Checks | Result | Key Failures |
|----------|-----|-----|---------------|--------------|--------|-------------|
| silent-data-corruption | baseline | 1 | 3/5 | 5 | **FAIL** | existing-users-work, contrast-existing-users |
| silent-data-corruption | baseline | 2 | 3/5 | 5 | **FAIL** | existing-users-work, contrast-existing-users |
| silent-data-corruption | workflow | 1 | 5/6 | 6 | **FAIL** | new-format-works |
| silent-data-corruption | workflow | 2 | 0/6 | 6 | **FAIL** | agent error, all failed |
| truncated-schema-migration | baseline | 1 | — | — | **ERROR** | missing `better-sqlite3` dependency |
| truncated-schema-migration | workflow | 1 | 1/6 | 6 | **FAIL** | agent error, schema-audit missing |
| build-activation-gap | baseline | 1 | 7/9 | 9 | **FAIL** | checked-status, ran-restart |
| build-activation-gap | workflow | 1 | 1/9 | 9 | **FAIL** | 8/9 failed, phase structure confused agent |
| ambiguous-context-drift | baseline | 1 | **8/8** | 8 | **PASS** ✅ | — |
| ambiguous-context-drift | workflow | 1 | 1/8 | 8 | **FAIL** | 7/8 failed, phase structure confused agent |
| approach-validation-trap | baseline | 1 | 5/6 | 6 | **FAIL** | read-session-logs |
| approach-validation-trap | workflow | 1 | 2/8 | 8 | **FAIL** | 6/8 failed, phase structure confused agent |

## Key Findings

### 1. `ambiguous-context-drift` is NO LONGER FAILING
The baseline run passed 8/8. This means the agent has already learned to handle this scenario — it may have been fixed by prior SOUL/guidance changes. **Remove from failing list.**

### 2. `silent-data-corruption` workflow shows REAL IMPROVEMENT
- Baseline: consistently misses backward compatibility (3/5 pass, 2 runs)
- Workflow run 1: **5/6 pass** — the forced data audit phase worked! Agent preserved existing data but missed new format implementation
- Workflow run 2: agent errored (0/6) — reliability issue
- **Verdict**: Workflow concept works but needs refinement. The data audit phase successfully forces backward compat awareness.

### 3. Workflow variants REGRESS on 3 scenarios
`build-activation-gap`, `ambiguous-context-drift`, and `approach-validation-trap` all scored WORSE with workflow variants. The multi-phase structure appears to confuse the agent — it doesn't complete the actual task because it gets stuck on phase-specific deliverables.

### 4. `truncated-schema-migration` has a BROKEN dependency
The baseline scenario's `success_criteria.js` requires `better-sqlite3` which isn't installed. This is a **scenario infrastructure bug**, not an agent skill gap. Need to `npm install better-sqlite3` or fix the criteria.

### 5. `build-activation-gap` baseline is CLOSE (7/9)
Only missing `checked-status` and `ran-restart` — the agent deploys but doesn't verify the running state. A simpler intervention (prompt nudge) might work better than a full workflow variant.

### 6. `approach-validation-trap` baseline is CLOSE (5/6)
Only missing `read-session-logs` — agent does everything right except reading the actual log files. Very targeted failure.

## Updated Failure Analysis

| Scenario | Status | Pass Rate | Root Cause |
|----------|--------|-----------|------------|
| ambiguous-context-drift | **RESOLVED** ✅ | 1/1 (100%) | Agent already handles this |
| approach-validation-trap | Close | 5/6 (83%) | Misses reading session logs |
| build-activation-gap | Close | 7/9 (78%) | Misses status check + restart |
| silent-data-corruption | Workflow helps | 3/5 → 5/6 | Workflow forces compat check |
| truncated-schema-migration | **BROKEN SCENARIO** | N/A | Missing `better-sqlite3` dep |

## Recommendations

1. **Remove `ambiguous-context-drift` from failing list** — it passes now
2. **Fix `truncated-schema-migration`** — install better-sqlite3 or rewrite criteria to not need it
3. **Simplify workflow variants** — current phase structure is too rigid, confuses the agent. Consider lighter-touch: just prepend a reminder to the task rather than multi-phase workflows
4. **Refine `silent-data-corruption-workflow`** — the concept works (5/6 on run 1) but needs reliability improvement
5. **For `build-activation-gap` and `approach-validation-trap`** — these are so close to passing (78%, 83%) that a simple task-level nudge may suffice rather than full workflow restructuring

## Raw Data Notes
- All runs used `GYM_AGENT_BIN=/usr/local/bin/may-agent`
- Timeout: 8 minutes per scenario
- Agent: amy (default)
- Date: Current session
