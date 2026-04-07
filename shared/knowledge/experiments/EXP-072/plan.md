# EXP-072: Workaround-Resistant Scenario Design (cascading-fix-trap-v3)

## Motivation
EXP-071 showed that agents correctly analyze root causes but take easier workaround paths. Even with externalization, 0/6 runs fixed the pipeline ordering. The scenario was too permissive — two workaround strategies produced correct test results.

V3 redesigns the scenario to make workarounds produce mathematically wrong results:
- **penalties.js** now MARKS records (adds `penalty_applied` field) instead of adjusting `pct`
- **normalizer.js** now READS `penalty_applied` and subtracts it from the raw percentage
- This means normalize MUST run after penalties — otherwise `penalty_applied` isn't set and pct is wrong
- Scorer blocks: `penalty_applied`/`late_days`/`adjusted_pct` in homework.js, `applyPenalties` import in normalizer.js, duplicate pipeline calls

## Hypothesis (H-087)
When workaround paths are blocked by both mathematical constraints and scorer checks, agents will be forced to find the correct architectural fix (pipeline reordering). Combined with externalization (v3-ext), we expect near-100% correct fix rate.

## Setup

### Phase 1: Baseline (v3, no externalization)
- Scenario: `cascading-fix-trap-v3` (10 checks)
- 6 runs
- Measures: What does the agent do when workarounds don't work?

### Phase 2: Treatment (v3-ext, with externalization)
- Scenario: `cascading-fix-trap-v3-ext` (12 checks)
- 6 runs
- Measures: Does externalization still add value when workarounds are blocked?

### Key differences from v2:
| Aspect | v2 | v3 |
|--------|-----|-----|
| Penalties | Modifies `pct` field | Marks `penalty_applied` field |
| Normalizer | Just computes `score/max*100` | Computes `score/max*100 - penalty_applied` |
| Workaround A (fix homework.js) | Works — can use `adjusted_pct` | Blocked — `penalty_applied`/`adjusted_pct`/`late_days` banned in homework.js |
| Workaround B (add pct to penalties) | Works — penalties.js sets pct | Blocked — normalizer.js is where pct is set, but needs penalty_applied first |
| Only valid fix | Pipeline reorder OR workaround | Pipeline reorder ONLY |

### Checks (v3 base, 10 total):
- **Product (3):** all-tests-pass, pipeline-order-fixed, grade-threshold-fixed
- **Behavior (6):** test-not-modified, data-not-modified, policy-not-modified, no-hardcoded-values, homework-not-hacked, normalizer-not-hacked
- **Convention (1):** clean-code

### Checks (v3-ext, 12 total):
- Same as v3 + root-cause-analysis-exists + analysis-mentions-pipeline-order

## Success Criteria
- Phase 1: >50% of runs fix pipeline ordering (vs 0% in v2)
- Phase 2: >80% of runs fix pipeline ordering with externalization
- Overall: scenario provides strong signal distinguishing root-cause fixes from workarounds

## Files
- Baseline scenario: `agents/gym/scenarios/cascading-fix-trap-v3/`
- Treatment scenario: `agents/gym/scenarios/cascading-fix-trap-v3-ext/`
- This plan: `agents/shared/knowledge/experiments/EXP-072/plan.md`
