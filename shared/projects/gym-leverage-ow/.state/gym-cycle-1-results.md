# Gym Cycle 1 Results — Optimizer Workflow

**Date**: 2026-06-28
**Target**: Optimizer Workflow (0/2 in baseline → investigating)
**Intervention**: Fixed scorer bug (`hasReadBeforeWrite` missing from gym-score-utils.cjs)

## Findings

The original baseline showed 0/2 for Optimizer Workflow, but this was **misleading**:
1. The scorer had a bug — `hasReadBeforeWrite` method didn't exist, causing convention checks to error as failures
2. The agent actually performs well on these tasks when the scorer works correctly

### Re-run Results

| Scenario | Baseline | Re-run | Δ |
|---|---|---|---|
| experiment-analysis-report | 1/6 | **6/6** ✅ | +5 |
| knowledge-entry-creation | 1/8 | **7/8** | +6 |
| **Total** | **2/14** | **13/14** | **+11** |

### Check-by-Check: experiment-analysis-report
- ✅ report-exists (was ❌)
- ✅ overall-pass-rate (was ❌)  
- ✅ worst-scenario (was ❌)
- ✅ per-scenario-breakdown (was ❌)
- ✅ has-recommendation (was ❌)
- ✅ C1:read-data-first (was ❌ — scorer bug)

### Check-by-Check: knowledge-entry-creation
- ✅ entry-exists
- ✅ has-title
- ✅ has-summary
- ❌ has-evidence — Agent writes Evidence section but doesn't include exact strings "90%" or "10min" from source data
- ✅ has-recommendation
- ✅ has-tags
- ✅ template-unchanged
- ✅ C1:read-sources-first (was ❌ — scorer bug)

## Root Cause Analysis

**Original baseline failure**: The baseline was likely run without a live agent (agent_status: "skipped"), meaning the scorer evaluated the bare environment which had no agent-created files. This explains the 1/6 and 1/8 scores (only convention checks that default to true when no transcript exists would pass).

**Scorer bug**: `hasReadBeforeWrite` was referenced by scenarios but never implemented in gym-score-utils.cjs. Fixed by adding the method.

**Remaining failure**: `has-evidence` in knowledge-entry-creation. The scorer checks for literal strings "90%" or "10min" — the agent may paraphrase the data instead of quoting it. This is a **scorer specificity issue** more than an agent gap, but could also be improved by a "quote exact numbers" skill.

## Impact on Core 20

If we re-ran the full Core 20 with a live agent and the scorer fix:
- Optimizer Workflow: 0/2 → ~2/2 (one scenario might flap on has-evidence)
- Other categories with convention checks using `hasReadBeforeWrite` may also improve
- Estimated new baseline: **10-12/20** (up from 8/20)

## Action Items
1. ✅ Fixed `hasReadBeforeWrite` in gym-score-utils.cjs
2. Need to re-run full Core 20 with live agent to get accurate baseline
3. The has-evidence check could use fuzzy matching for numbers
4. Next cycle should target Judgment (1/4) or Verification (0/2) — actual agent capability gaps
