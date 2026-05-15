# Iteration 23: Criteria Creation for NO_CRITERIA Scenarios

## Summary

Analyzed all 22 NO_CRITERIA scenarios. Created `success_criteria.js` for **3 scenarios** that were actionable. The remaining 19 are not actionable for file-based criteria (judge-only, no environment, or sub-scenario containers).

## New Criteria Files Created

| Scenario | Checks | Verified | Notes |
|----------|--------|----------|-------|
| `explore-config-drift` | 6 | ✅ Yes (5/6 fail correctly) | Report existence, content quality, SSL identification |
| `phase-boundary-violation` | 4 | ⚠️ No environment dir | SECURITY-AUDIT.md creation, no-src-modification restraint |
| `unverified-finish-guard` | 4 | ⚠️ No environment dir | truncate() fix correctness + verification behavior |

## Classification of All 22 NO_CRITERIA Scenarios

### ✅ Created File-Based Criteria (3)
- **explore-config-drift** — Investigation/report scenario with full environment. 6 checks.
- **phase-boundary-violation** — Restraint scenario (analysis only, no code changes). 4 checks. Needs environment created at runtime.
- **unverified-finish-guard** — Bug fix + verification behavior. 4 checks. Needs `string-utils.js` in environment.

### ℹ️ Already Has Criteria (1)
- **cross-file-edit-consistency** — Already has complete `success_criteria.js` with 5 checks

### 📋 Judge-Only (Already Have judge_criteria.md) (4)
- **confabulation-detection** — Tests checkpoint verification behavior (behavioral, not file-based)
- **dispatch-nonexistent-project** — Tests handling of nonexistent project (behavioral)
- **stale-checkpoint-resume** — Tests stale checkpoint detection (behavioral)
- **write-conflict-recovery** — Tests edit retry behavior (behavioral)

### 🔧 Workspace-Generating / No Environment (8)
These scenarios have no `environment/` directory. The gym runner generates workspaces at runtime from `package.json` + scaffold configs. Cannot write static criteria without the runtime workspace.

- **scout-coder-calc** — Two-phase invoice pipeline debugging (EXP-176)
- **scout-coder-calc-baseline** — Single-phase baseline for above
- **scout-coder-event-flow** — Two-phase event pipeline debugging (EXP-176)
- **scout-coder-stale-cache** — Two-phase stream pipeline debugging (EXP-176)
- **ambiguous-context-drift-ext-v2** — EXP-092 variant (uses base scenario workspace)
- **ambiguous-context-drift-ext-v3** — EXP-092 variant (uses base scenario workspace)
- **contradictory-requirements-mismatched-fewshot** — Injected context experiment
- **escalation-judgment-mismatched-fewshot** — Injected context experiment
- **read-before-edit-fewshot** — Injected context experiment

### 📦 Container / Incomplete (6)
- **multi-session** — Parent directory containing 23 sub-scenarios (each has own criteria)
- **scout-literature-gap** — Empty environment directory, no task.md
- **scout-question-decomposition** — Empty environment directory, no task.md
- **sunk-cost-escape** — Empty src/ and test/ directories
- **use-persistent-task-STRUCT** — Has agents/ dir but no clear task
- **stale-checkpoint-resume** — No environment (judge-only, listed above)

## Verification

```
explore-config-drift: ✅ Valid JSON, 6 checks, 5 fail (correct - no agent work yet)
phase-boundary-violation: ⚠️ No environment/ dir - needs runtime workspace
unverified-finish-guard: ⚠️ No environment/ dir - needs runtime workspace  
cross-file-edit-consistency: ✅ Already had complete criteria
```

## Net Impact

- **Scenarios with evaluable criteria**: +3 (from 410 → 413 of 432)
- **Remaining NO_CRITERIA**: 19 → 18 (minus cross-file which already had criteria)
  - 4 are judge-only (valid, just different eval method)
  - 8 need runtime workspace generation
  - 6 are incomplete/containers

## Files Created
1. `/app/agents/gym/scenarios/explore-config-drift/success_criteria.js` (6 checks)
2. `/app/agents/gym/scenarios/phase-boundary-violation/success_criteria.js` (4 checks)
3. `/app/agents/gym/scenarios/unverified-finish-guard/success_criteria.js` (4 checks)
