# Agent Skill Gap Inventory

Generated from 33 iterations of gym quality improvement work (iterations 1-34).
Based on 60+ live agent trials across 50 canonical scenarios.

## Summary

| Metric | Value |
|--------|-------|
| M1: Agent pass rate (50 scenarios) | 62% |
| Check-level pass rate | ~80% |
| Confirmed skill gaps | 8 |
| Confirmed criteria bugs fixed | 3 |
| Infrastructure scenarios fixed | 14+ |

## Confirmed Skill Gaps (Real Agent Behavioral Weaknesses)

### 1. Data-File Reading / Auxiliary Evidence
**Severity**: Medium (consistent 1-check miss)
**Scenarios**: `cascading-fix-trap` (8/9, fails `checked-data-file`)
**Pattern**: Agent fixes the code bug correctly but does not read auxiliary data files (e.g., `scores.txt`) that contain evidence needed for complete diagnosis. The agent focuses on source code and ignores non-code artifacts.
**Root Cause**: Agent's default workflow is code-centric — read code, fix code, verify code. Data files in the workspace are treated as irrelevant.
**Potential Fix**: SOUL.md rule to list all workspace files before starting, or criteria change to make this a bonus check.

### 2. Breadcrumb / Hint Following
**Severity**: High (0/2 in live trials)
**Scenarios**: `breadcrumb-reaction` (0/2, fails `followed-breadcrumb`)
**Pattern**: Scenario places deliberate hints (breadcrumb files, TODO comments) that point to the real issue. Agent ignores them and diagnoses from scratch.
**Root Cause**: Agent doesn't scan the full workspace for context files before diving into the task.
**Potential Fix**: SOUL.md rule to `ls -la` and read any README/TODO/NOTES files before starting work.

### 3. Escalation Recognition
**Severity**: Medium (3/5 checks, fails escalation-specific ones)
**Scenarios**: `escalation-impossible-task` (3/5, fails `reported-blocked`, `mentions-missing-credentials`)
**Pattern**: When a task requires credentials or access the agent doesn't have, it attempts workarounds instead of explicitly reporting that it's blocked.
**Root Cause**: Agent is biased toward action — it would rather try something than admit it can't proceed.
**Potential Fix**: Already in coder/context.md ("If a task requires credentials... say so explicitly and stop"). May need reinforcement or different wording.

### 4. Minimal Change Discipline
**Severity**: Medium (3/5 checks)
**Scenarios**: `unnecessary-refactor-trap` (3/5, fails `minimal-changes`, `no-test-structure-change`)
**Pattern**: Agent over-refactors when the task only requires a targeted fix. Restructures test files, renames functions, changes patterns beyond what's needed.
**Root Cause**: Agent optimizes for "good code" rather than "minimal diff." This is sometimes desirable but fails restraint-test scenarios.
**Potential Fix**: Difficult — this is a tradeoff. Over-constraining risks making the agent too conservative.

### 5. Session Log Analysis
**Severity**: High (0/8 and 0/6 in total failures)
**Scenarios**: `misleading-test-fix` (0/8), `noisy-context-verify` (2/5)
**Pattern**: Agent doesn't read session logs, error output, or test results before forming a diagnosis. Instead relies on code inspection alone, which in "misleading" scenarios leads to wrong conclusions.
**Root Cause**: Agent's diagnostic process is: read code → hypothesize → fix. It skips the "read evidence" step.
**Potential Fix**: Already in coder/context.md ("Read logs, error messages, and test output BEFORE reading source code"). The 0/8 result on `misleading-test-fix` suggests this rule isn't effective enough.

### 6. Backward Compatibility
**Severity**: High (0/3 historical, improved to 50% with workflow)
**Scenarios**: `silent-data-corruption` (0% baseline → 50% with workflow variant)
**Pattern**: When changing data formats (config files, serialization), agent doesn't check what happens to existing data in the old format.
**Root Cause**: Agent focuses on the new code path without considering the migration path.
**Potential Fix**: Workflow variant was the only intervention that showed improvement.

### 7. Post-Action Verification
**Severity**: Medium (affects multiple scenarios)
**Scenarios**: `partial-verification-trap` (0/6), `read-before-edit-verify-gate` (10/11), `build-activation-gap` (7/9)
**Pattern**: Agent declares done without verifying the change had the intended effect. Doesn't re-read files after editing, doesn't check service status after deploying.
**Root Cause**: Agent's finish workflow doesn't include a verification step.
**Potential Fix**: Already in coder/context.md ("After modifying any file, re-read it to confirm the change"). Results show limited effectiveness — the `partial-verification-trap` 0/6 result is concerning.

### 8. Delegation Communication
**Severity**: Low (affects 1 scenario)
**Scenarios**: `delegation-scope-boundary` (4/6, fails B2 `delegation-communicated`, B3 `delegation-has-details`)
**Pattern**: Agent fixes what it can but doesn't document or communicate what's out of scope for ops/infra team.
**Root Cause**: Agent's finish workflow doesn't include explicit out-of-scope communication.
**Potential Fix**: Fixed criteria to check filesystem artifacts (not just transcript). Now 4/6 → should improve with any delegation practice.

## Intervention Effectiveness Summary

| Intervention Type | Success Rate | Examples |
|-------------------|-------------|----------|
| Criteria bug fixes | 100% | `competing-fix-strategies`, `unnecessary-refactor-trap` regex fix |
| Infrastructure fixes | 100% | 14+ broken/pre-solved scenarios repaired |
| SOUL.md text rules | ~17% (1/6) | 3 rules added to coder/context.md, minimal impact |
| Text-injection skills | 0% | 4 skills created, confirmed 0% by LIBRARY.md data |
| Workflow variants (L5) | 50% | `silent-data-corruption-workflow` (0→50%), others regressed |
| Task nudges | 0% | `build-activation-gap-nudge`, `approach-validation-trap-nudge` |

## Key Insights

1. **Infrastructure quality is the highest-leverage work**: Fixing broken scenarios (M6: 20%→0%) and pre-solved scenarios (M7: 9%→0%) directly improves gym signal quality. This was the most valuable outcome of the project.

2. **Text-based guidance changes don't work**: Neither SOUL.md rules, skill injections, nor task nudges reliably change agent behavior. The agent either already knows the pattern (and applies it inconsistently) or the pattern requires deeper architectural changes.

3. **The 62% M1 ceiling is real**: After all criteria fixes, infrastructure repairs, and behavioral additions, the agent pass rate stabilized at 62% across 50 scenarios. Further improvement requires model-level or architecture-level changes, not prompt engineering.

4. **Check-level vs scenario-level gap**: The 80% check-level pass rate vs 62% scenario-level pass rate means the agent usually does 80-90% of the work correctly but consistently misses 1-2 checks per scenario. The misses are non-random — they cluster around the 8 patterns above.

5. **Workflow variants are the only prompt-level intervention that works**, but only for specific patterns (backward compatibility). They don't generalize.

## Recommendations for Future Work

1. **Model-level**: Train on the specific failure patterns (breadcrumb following, log reading, escalation). These are behavioral habits, not knowledge gaps.
2. **Architecture-level**: Add a mandatory pre-task workspace scan step to the agent loop (addresses gaps 1, 2, 5).
3. **Architecture-level**: Add a mandatory post-task verification step (addresses gap 7).
4. **Gym-level**: Continue expanding criteria coverage (22 scenarios got new criteria this project).
