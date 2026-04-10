# EXP-114: FM-2.1 Approach Decomposition Guard — Results

**Status**: COMPLETED
**Date**: 2026-04-10
**Author**: Coach
**Type**: Gym experiment (H3 test)
**Session**: s_1775805867091_764

---

## What We Tested

**H3**: Requiring agents to write APPROACH.md before acting will improve pass rate by ≥20pp on the `approach-validation-trap` scenario.

### Conditions

| Condition | Scenario | Intervention | N |
|-----------|----------|-------------|---|
| Baseline | `approach-validation-trap` | None — agent gets task directly | 3 |
| Treatment | `approach-validation-trap-decomp` | Must write APPROACH.md before analysis.md | 3 |

### Scenario Design

Agent must analyze why a fake experiment (EXP-077) failed. The workspace contains:
- A misleading summary suggesting "scenario too easy" (red herring)
- Session logs revealing the real cause: intervention applied to wrong file (config.md instead of SOUL.md)
- The correct answer requires reading session logs, not just the summary

---

## Raw Results

### Baseline: `approach-validation-trap` (no intervention)

| Run | Passed | Checks | Duration | Session ID |
|-----|--------|--------|----------|------------|
| 1 | ✅ PASS | 6/6 | ~170s | (run 1) |
| 2 | ✅ PASS | 6/6 | ~120s | (run 2) |
| 3 | ✅ PASS | 6/6 | ~95s | (run 3) |

**Baseline pass rate: 3/3 (100%)**

All 6 checks passed in every run:
- ✓ analysis-exists (product)
- ✓ identifies-wrong-file (product)
- ✓ rejects-ceiling-effect (product)
- ✓ read-session-logs (behavior)
- ✓ not-premature (behavior)
- ✓ reasonable-ops (efficiency)

### Treatment: `approach-validation-trap-decomp` (forced APPROACH.md)

| Run | Passed | Checks | Duration | Session ID |
|-----|--------|--------|----------|------------|
| 1 | ✅ PASS | 8/8 | ~210s | (run 1) |
| 2 | ✅ PASS | 8/8 | 206s | s_1775806350249_0 |
| 3 | ✅ PASS | 8/8 | 114s | s_1775806565310_0 |

**Treatment pass rate: 3/3 (100%)**

All 8 checks passed in every run:
- ✓ analysis-exists (product)
- ✓ identifies-wrong-file (product)
- ✓ rejects-ceiling-effect (product)
- ✓ approach-md-exists (product)
- ✓ read-session-logs (behavior)
- ✓ not-premature (behavior)
- ✓ approach-before-analysis (behavior)
- ✓ reasonable-ops (efficiency)

---

## Analysis

### H3 Verdict: INCONCLUSIVE (Ceiling Effect)

| Metric | Baseline | Treatment | Delta |
|--------|----------|-----------|-------|
| Pass rate | 100% (3/3) | 100% (3/3) | 0pp |
| Avg checks passed | 6.0/6.0 | 8.0/8.0 | N/A (different max) |

**Both conditions hit 100% — the scenario is too easy to measure the intervention effect.**

The agent (coach) correctly identified the root cause (wrong file patched) in all 6 runs, regardless of whether forced externalization was applied. The "red herring" (misleading summary suggesting scenario-too-easy) was not strong enough to trap the agent.

### Why the Ceiling Effect?

1. **Coach's analysis skill is high**: Coach regularly does root-cause analysis on experiment results — this is exactly its core workflow. The task is well within coach's competency.

2. **The red herring was too obvious**: The misleading summary file was labeled with clear indicators. An agent skilled in analysis naturally looks past summaries to raw data (session logs).

3. **The session logs were too revealing**: Once the agent reads any session log, the wrong-file error is immediately apparent. There's no ambiguity in interpretation once the evidence is accessed.

4. **Single-agent testing**: Coach was both the agent being tested AND the agent that designed the scenario. The scenario may be calibrated to coach's strengths without intending to be.

### What This Means

- **The forced externalization (APPROACH.md) does NOT hurt performance** — no timeout, no over-compliance (EXP-018 risk did not materialize)
- **We cannot conclude whether it helps** — ceiling effect masks any potential benefit
- **The scenario needs to be harder** to discriminate between conditions

### Comparison to Design Predictions

| Design Prediction | Actual | Match? |
|-------------------|--------|--------|
| Baseline ~40-50% pass | 100% pass | ❌ Way higher |
| Treatment ~60-80% pass | 100% pass | ❌ Way higher |
| Treatment ≥20pp improvement | 0pp (ceiling) | ❌ Cannot measure |

The design document predicted baseline pass rates of 40-50%. In reality, the scenario is far too easy for coach. This overestimated the difficulty because:
- The scenario tests *analysis* (coach's strength), not *coding under ambiguity*
- The red herring requires more sophistication — perhaps conflicting evidence rather than a single misleading file
- Coach's prompt includes explicit guidance about evidence-first analysis

---

## Confirmed Side-Findings

### H1 (confirmed by analysis in design doc): FM-2.1 Is Heterogeneous
The design document's pre-experiment analysis showed FM-2.1 is 54.5% tactical (tool misuse) and 45.5% strategic. No single guard can address it all. **This finding stands and is the most valuable output of EXP-114.**

### Forced Externalization Is Safe (Low-Cost)
The treatment condition added APPROACH.md overhead without causing:
- Timeouts (all runs completed well under limits)
- Over-compliance (agent didn't get stuck planning)
- Worse performance (still 100%)

This suggests forced externalization can be added to workflows without risk, even if we can't prove benefit on this scenario.

---

## Recommendations

### 1. Do NOT Promote Forced APPROACH.md Externalization (Yet)
No evidence it helps. The 100% baseline means we can't distinguish signal from noise.

### 2. Redesign the Scenario for Harder Discrimination
To test H3 properly, the scenario needs:
- **Stronger red herring**: Conflicting evidence, not just a misleading summary
- **Deeper buried real cause**: Require reading 3+ files to piece together the root cause
- **Time pressure**: Shorter operation budget to force quick decisions
- **Different agent**: Test an agent less skilled at analysis (coder, optimizer)

### 3. Prioritize Tool Schema Guard (EXP-114a)
The design analysis is clear: 36.6% of FM-2.1 is tool schema errors. This is the highest-impact, highest-confidence intervention. It doesn't need a gym scenario — it's an infrastructure change.

### 4. Track as Knowledge Entry
Create KE entry documenting FM-2.1 sub-type analysis. This is valuable regardless of gym results.

---

## Data Integrity

- All 6 gym runs completed with exit code 0
- Baseline and treatment used identical prompt (coach SOUL.md, 0dd30a7ffcfc hash)
- Framework version: 7c8dc22
- Scenario categories: judgment, root-cause-analysis
- Tags: behavior, fm-2.1, analysis, red-herring, exp-114

---

## Appendix: Design Document Hypotheses Status

| Hypothesis | Status | Evidence |
|-----------|--------|---------|
| H1: FM-2.1 not amenable to single guard | ✅ CONFIRMED | Sub-type analysis in design doc |
| H2: Tool schema hardening reduces tactical FM-2.1 | ⏳ UNTESTED | Requires infrastructure build (EXP-114a) |
| H3: Forced externalization reduces strategic FM-2.1 | ❓ INCONCLUSIVE | Ceiling effect — 100% baseline, 100% treatment |
| H4: Coach has higher strategic FM-2.1 | ❌ DISCONFIRMED | Coach is 72.3% tactical (design analysis) |
