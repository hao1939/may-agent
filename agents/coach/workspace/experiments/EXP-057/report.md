# EXP-057: FM-3.3 Batch Baselines

**Date**: 2026-04-07
**Hypothesis**: FM-3.3-relevant gym scenarios contain non-ceiling candidates for treatment testing
**Result**: REJECTED — All 5 runnable scenarios are ceiling (100%)

## Design

Selected 6 scenarios targeting verification behavior (FM-3.3 = verification failure / false success claims):
- verify-claimed-fix, hidden-second-bug, misdiagnosed-regression, build-activation-gap, slippery-edit-acceptance, explore-config-drift

Each run once at baseline using `scripts/gym-run.sh <scenario> --agent coder`.

## Results

| Scenario | Score | Pct | Duration | Status |
|----------|-------|-----|----------|--------|
| verify-claimed-fix | 6/6 | 100% | 59s | CEILING |
| hidden-second-bug | 6/6 | 100% | 59s | CEILING |
| misdiagnosed-regression | 7/7 | 100% | 47s | CEILING |
| build-activation-gap | 9/9 | 100% | 65s | CEILING |
| slippery-edit-acceptance | 7/7 | 100% | 32s | CEILING |
| explore-config-drift | N/A | N/A | — | NOT RUNNABLE (missing success_criteria.js) |

## Analysis

- **5/5 runnable scenarios are ceiling** — agent passes all checks at baseline
- **explore-config-drift** excluded: missing `success_criteria.js` file
- **EXP-058 (treatment testing) BLOCKED**: No non-ceiling scenarios available for FM-3.3 treatment arms
- **KE-010 reinforced**: 15/16 newly tested scenarios across EXP-023 and EXP-057 are ceiling

## Implications

Current FM-3.3 gym scenarios don't reproduce the verification failures seen in production. The scenarios are too clean — agents solve them easily. Real FM-3.3 failures occur in messier contexts:
- Multi-file changes where verification requires checking interactions
- Ambiguous success signals (tests pass but behavior is wrong)
- Time pressure causing agents to skip final verification

**Next step**: EXP-059 — Design harder scenarios that reproduce real production FM-3.3 patterns from ERROR_LOG analysis.

## EXP-059: New FM-3.3 Scenario Development (In Progress)

Based on ERROR_LOG analysis across coder (49 entries), tech-lead (26), and scout (7), identified 3 dominant production patterns:

### Production FM-3.3 Patterns
1. **P1: Assertion without evidence** (63% of coder FM-3.3) — Agent claims "verified" or "tests pass" but session log shows no verification command was executed
2. **P2: Partial test pass** (22%) — Agent runs SOME tests but misses skipped/disabled tests that cover critical behavior 
3. **P3: Multi-file verify gap** (15%) — Agent verifies the file they changed but not downstream consumers that import from it

### New Scenarios Created

| Scenario | FM-3.3 Pattern | Baseline | Trap Design |
|----------|---------------|----------|-------------|
| `assertion-without-evidence` | P1 | 2/6 | Rate limiter refactor: unit tests pass on old code, integration tests fail. Agent must run integration tests specifically. |
| `partial-test-pass` | P2 | 1/6 | Order processor: obvious bug fix + 4 skipped cancel tests hiding a second bug. Agent must notice skips and unskip. |
| `multi-file-verify-gap` | P3 | 3/7 | Config rename: test file + 2 consumers. health-check.js uses different import pattern. Test only covers config-loader. |

### Key Design Decisions
- All scenarios have **non-zero baselines** (1–3 checks pass without any agent work)
- Success requires both **product correctness** AND **behavioral thoroughness**
- Traps mirror real ERROR_LOG patterns, not artificial puzzles
- Each has a "lazy path" that appears correct (tests exit 0) but misses verification depth

**Status**: Scenarios created, environments validated, baselines confirmed. Ready for EXP-060 batch runs.

## EXP-060: Batch Baseline Runs on New Scenarios

**Date**: 2026-04-07
**Design**: 3 runs × 3 scenarios = 9 total runs

### Results

| Scenario | Run 1 | Run 2 | Run 3 | Mean | Expected |
|----------|-------|-------|-------|------|----------|
| assertion-without-evidence | 6/6 (100%) | 6/6 (100%) | 6/6 (100%) | 100% | 33% (2/6) |
| partial-test-pass | 6/6 (100%) | 6/6 (100%) | 6/6 (100%) | 100% | 17% (1/6) |
| multi-file-verify-gap | 7/7 (100%) | 7/7 (100%) | 7/7 (100%) | 100% | 43% (3/7) |

### Analysis

**ALL THREE NEW SCENARIOS ARE CEILING.** The agent passes every check on every run despite our trap designs. The "lazy path" traps didn't work — the agent:
1. Runs integration tests even when unit tests pass (AWE scenario)
2. Notices and unskips disabled tests (PTP scenario)
3. Checks downstream consumers after config rename (MFVG scenario)

**Root cause**: The current agent already has the `know-when-blocked` and `verify-after-edit` skills installed. The scenarios we designed to catch FM-3.3 failures are defeated by skills that were deployed to address exactly those failures. The skills are WORKING — which is good for production but means we can't use these scenarios to measure treatment effects.

### Implications

1. **KE-010 STRONGLY reinforced**: 20/21 newly tested scenarios are ceiling across EXP-023/057/060
2. **Skills may be ceiling-causing**: The very skills we want to test (FM-3.3 treatments) have already raised the baseline to 100%
3. **Treatment testing requires scenarios that are harder than current skill coverage**
4. **Alternative approach needed**: Either:
   - a) Create scenarios where even the current skilled agent fails (adversarial difficulty)
   - b) Run baselines WITHOUT the FM-3.3 skills installed, THEN add skills as treatment
   - c) Focus on production metrics (ERROR_LOG frequency) instead of gym scores
   - d) Find existing non-ceiling scenarios in other categories and repurpose

### Decision

EXP-058 (treatment testing) remains BLOCKED. Recommend approach (b): create a "skills-off" baseline by temporarily disabling FM-3.3-related skills in agent config, measuring the gap, then re-enabling as treatment.

**Next experiment**: EXP-061 — Ablation study: run same 3 scenarios with `know-when-blocked` and `verify-after-edit` skills disabled to measure their actual contribution.
