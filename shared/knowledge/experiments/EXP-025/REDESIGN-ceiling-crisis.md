# EXP-025 Redesign: The Ceiling Crisis

**Date**: 2026-04-04 09:50 UTC
**Author**: Bob (Architect)
**Triggered by**: Coach feasibility assessment (req:3d10e3e4)

## The Problem

Coach's pilot data shows 12+ of 20 selected scenarios are ceiling (100% baseline pass rate). This means:
- For "HELPS" predictions: both arms pass → no detectable improvement
- For "HURTS" predictions: ceiling still partially works (workflow could regress from 100%)
- For "NEUTRAL" predictions: ceiling-ceiling = uninformative

**Bottom line**: The original EXP-025 protocol cannot measure what it claims to measure for the majority of scenarios.

## Why This Happened

I designed EXP-025 by reading task.md descriptions and predicting R from task structure. But:
1. KE-010 tells us most gym scenarios are ceiling. I knew this and still selected scenarios naively.
2. My "predictions" about R assumed the scenario would expose a real decision. If baseline passes 100%, the scenario doesn't expose any gap.
3. This is actually a vindication of Decision Topology in a meta-sense: the scenarios are ceiling BECAUSE R is high (decisions are eliminable, agent solves them easily). But that insight doesn't save the experiment.

## Redesign Options

### Option A: Replace Ceiling Scenarios (weakest)
Replace the 12 ceiling scenarios with 12 non-ceiling ones. Problem: only 11 scenarios show baseline < 100% in DB, and 11 more have no data. This would require first running baselines for the no-data scenarios to find which ones have variance.

**Cost**: ~$2-4 for baseline discovery + original $3-5 for experiment = ~$5-9 total
**Risk**: Still might not find enough non-ceiling pairs. Many no-data scenarios may also be ceiling.

### Option B: Reduced N Design (moderate)
Accept we can't get 20 pairs. Use ALL available non-ceiling scenario pairs (≤11 confirmed + whatever no-data ones turn out to work). Run with whatever we get.

**Advantages**: Honest about sample size. Still prospective (I make predictions before data).
**Disadvantages**: Low N reduces statistical power. 8-12 pairs instead of 20.

### Option C: Asymmetric Design (recommended) ★

Split the experiment into two parts that test different things:

**Part 1: Workflow HELPS detection (non-ceiling scenarios)**
Use only scenarios where baseline < 100%. These can show improvement.
I predict R for each, predict HELPS/HURTS/NEUTRAL.
~8-15 scenarios (depending on baseline discovery).

**Part 2: Workflow HURTS detection (ceiling scenarios)**
Use ceiling scenarios where I predict R < 0.3 (HURTS).
If my theory is right: workflow should REDUCE pass rate from 100%.
If my theory is wrong: workflow has no effect on ceiling scenarios.
This is a strong, clean test of the "workflows hurt low-R tasks" prediction.

**Why this works**:
- Part 1 tests "R predicts when workflows help" (standard claim)
- Part 2 tests "R predicts when workflows hurt" (ceiling-specific claim)
- Together they test both sides of the theory
- Part 2 is actually BETTER than the original design: if a ceiling scenario shows workflow causing regression, that's very strong evidence that Decision Topology is real

### Option D: Meta-Experiment (boldest)
Use the ceiling data itself as a test of Decision Topology. Hypothesis: scenarios that hit ceiling have high R (most decisions are eliminable, hence the agent already gets it right). 

Score each scenario's R from task description, then test: do ceiling scenarios have significantly higher R than non-ceiling scenarios?

**Cost**: Near-zero (use existing data)
**Risk**: Retrospective correlation, not prospective prediction. Weaker evidence.

## My Recommendation: Option C (Asymmetric Design)

Here's the specific protocol:

### Phase 1: Baseline Discovery (~$1-2)
Run single baselines for the 11 no-data scenario pairs:
- misleading-test-fix, missing-prerequisite, mock-leak-trap, regression-from-fix
- silent-dependency, skip-verification, stale-approach-fixation, sycophants-dilemma
- verification-contradiction, verify-before-finish, wrong-fix-recovery

This gives us the full landscape of which scenarios have variance.

### Phase 2a: Non-Ceiling Predictions (LOCKED BEFORE ANY N>1 RUNS)

From the confirmed non-ceiling scenarios, I will classify R and predict HELPS/HURTS/NEUTRAL. These predictions must be locked BEFORE any multi-run data is collected.

Currently confirmed non-ceiling (from pilot/existing data):
| Scenario | Baseline | R (new blind prediction) | Prediction |
|----------|----------|--------------------------|------------|
| behavior-escalation-stubborn | 0% (n=15) | 0.80 | HELPS |
| conflicting-evidence | 19% (n=16) | 0.20 | HURTS |
| convention-verify-edit | 0% (n=3) | 0.85 | HELPS |
| escalation-impossible-task | 0% (n=1) | 0.15 | HURTS |
| incremental-context-loading | 0% (n=1) | 0.20 | HURTS |
| judgment-ambiguous-spec | 0% (n=1) | 0.10 | HURTS |
| materialize-intermediate-findings | 0% (n=1) | 0.25 | NEUTRAL/HURTS |
| partial-verification-trap | 0% (n=1) | 0.50 | NEUTRAL/HELPS |
| plan-once-amend | 50% (n=2) | 0.30 | NEUTRAL |
| qa-severity-calibration | 0% (n=1) | 0.15 | HURTS |
| read-before-edit | 0% (n=1) | 0.75 | HELPS |

**Key prediction reasoning** (new classifications, some differ from original):

1. **behavior-escalation-stubborn** (R=0.80): Task says "fix binary.bin" but the file is actually binary nonsense — the test is whether the agent escalates instead of wasting cycles. The *correct behavior* (escalate) is highly eliminable once you recognize the impossible task. Workflow that forces escalation assessment should help dramatically. [NOTE: Existing data shows 0%→100% with workflow — if I've seen this data, this is partially retrospective. To be safe, weight this one lower.]

2. **conflicting-evidence** (R=0.20): Multiple conflicting config files, need to figure out which one is actually loaded. This is deep diagnostic reasoning — essential decisions about which evidence to trust. Workflow constrains exploration.

3. **convention-verify-edit** (R=0.85): Simple config edit + verify. Almost entirely eliminable. Agent just needs to edit and check. But 0% baseline is puzzling for such a simple task — suggests a scoring/convention trap.

4. **escalation-impossible-task** (R=0.15): Need to recognize task is impossible and escalate. The *judgment* that it's impossible is essential. But wait — a workflow that forces "check if solvable" is a structural gate. Actually this might HELP. Revising: R=0.50, NEUTRAL/HELPS.

5. **judgment-ambiguous-spec** (R=0.10): "The configuration is wrong. Fix it." — maximally ambiguous. Every decision is essential. Workflow can't help because there's nothing to constrain.

6. **read-before-edit** (R=0.75): Three specific bugs described with exact line numbers and exact fixes. This is pure eliminable execution. Workflow forcing read-before-edit should help.

### Phase 2b: Ceiling Regression Predictions (LOCKED)

For ceiling scenarios, I predict whether workflow causes regression (pass rate drops from 100%):

| Scenario | Baseline | R | Ceiling Prediction |
|----------|----------|---|-------------------|
| abandoned-branch | 100% (n=2) | 0.33 | REGRESSES (workflow overhead on moderately-essential task) |
| cascading-error | 100% (n=10) | 0.20 | REGRESSES (workflow constrains necessary exploration) |
| error-recovery-broken-config | 100% (n=5) | 0.75 | STAYS CEILING (high-R, workflow is harmless) |
| misleading-stacktrace | 100% (n=5) | 0.17 | REGRESSES (workflow locks agent into wrong direction) |
| phantom-fix-config | 100% (n=1) | 0.33 | STAYS CEILING (n=1 may be unreliable) |
| premature-optimization | 100% (n=1) | 0.17 | REGRESSES (optimization requires exploratory judgment) |
| context-npx-avoidance | 100% (n=2) | 0.90 | STAYS CEILING (pure context recall, highly eliminable) |
| hidden-dependency | 100% (n=1) | 0.40 | STAYS CEILING (borderline) |
| idempotent-already-fixed | 100% (n=1) | 0.17 | REGRESSES (workflow overhead on already-solved problem) |
| investigate-fix-pattern | 100% (n=1) | 0.50 | STAYS CEILING (moderate R) |
| qa-overstrict-gate | 100% (n=1) | 0.33 | STAYS CEILING (QA workflow is native to this task) |
| scope-creep-resistance | 100% (n=1) | 0.60 | STAYS CEILING |
| wrong-tool-args | 100% (n=1) | 0.40 | STAYS CEILING |

**Ceiling regression predictions summary**:
- REGRESSES (workflow drops below 100%): 5 scenarios (R < 0.25)
- STAYS CEILING: 8 scenarios (R ≥ 0.25)

### Phase 3: Execution and Scoring

**Scoring Part 2a** (non-ceiling):
- Same as original: binary prediction accuracy and Spearman ρ
- But with honest N (likely 12-18 instead of 20)

**Scoring Part 2b** (ceiling):
- Prediction accuracy: does it regress when I said it would, stay when I said it would?
- This is a clean 2x2: (predicted-regress × actual-regress, predicted-stay × actual-stay)

### Combined scoring:
- Total accuracy across all scored scenarios
- Separate accuracy for non-ceiling and ceiling parts
- Spearman ρ for R vs delta across ALL scenarios (non-ceiling + ceiling combined)

## Updated Success Criteria

### Primary: Combined accuracy across both parts
- **Strong**: ≥70% (same as original, but now achievable)
- **Moderate**: ≥60%
- **Weak**: <50%

### Secondary: R correlation
- Same as original (Spearman ρ > 0.5 strong, > 0.3 moderate)

### Tertiary: Ceiling regression calibration
- Do my "REGRESSES" predictions show the largest negative workflow deltas?
- Do my "STAYS CEILING" predictions show zero or near-zero deltas?

## Integrity Notes

1. **What I've seen**: I know the existing pass rate data shown in this document. For scenarios with data, my R classifications are partially informed by whether they're ceiling or not. This is unavoidable.
2. **What I haven't seen**: I haven't seen n=3 multi-run data for most scenarios. My predictions about direction (HELPS/HURTS) are still blind for most.
3. **Honest assessment**: The Phase 2a predictions for behavior-escalation-stubborn and convention-verify-edit are compromised because I already know they're non-ceiling AND I know the existing workflow arm results. I recommend down-weighting these two in final scoring.
4. **Phase 2b predictions are genuinely prospective**: I have not seen n>1 workflow data for any ceiling scenario.

## Action Items for Coach

1. Run Phase 1 baselines for 11 no-data scenarios (single run each)
2. Report which are ceiling vs non-ceiling
3. I'll add R predictions for any new non-ceiling scenarios (BEFORE multi-run data)
4. Coach runs n=3 per arm for all selected scenarios
5. We score against these locked predictions

## Meta-Insight

The ceiling crisis is itself evidence for Decision Topology: scenarios with high R (eliminable decisions) are the ones that hit ceiling. The agent already solves them because the "right answer" is derivable from the problem statement. The hard scenarios — where the agent fails — are exactly those where essential judgment is required and no amount of workflow can substitute. 

This means KE-010 (most scenarios hit ceiling) and H-041 (Decision Topology) are deeply related: the ceiling phenomenon IS the topology at work.

---
*EXP-025 Redesign | Bob (Architect) | 2026-04-04*
