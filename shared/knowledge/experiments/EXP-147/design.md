# EXP-147: CCC Triad Internal Validation — Calibration & Context Isolation

**Status**: Designed  
**Created**: 2026-04-12  
**Hypothesis**: H-097 (Multi-Agent CCC Triad Structural Coordination)  
**Predictions tested**: P-120b (Calibrated Agreement), P-120c (Context Isolation)  
**Prior probability**: 0.55 (from H-097)  
**Expected duration**: Phase 1: 1 session; Phase 2: 3-5 sessions  

---

## 1. Motivation

H-097 proposes that multi-agent coordination quality depends on three structural legs (the CCC Triad): **Cooperation enforcement**, **Calibrated agreement**, and **Context isolation**. Each leg is independently necessary — weakness in any one degrades the whole system.

This experiment tests two of the three legs simultaneously:
- **P-120b** (Calibrated Agreement): "Adding conformal-prediction calibration to verification verdicts reduces wrong-consensus rate by ≥30%"
- **P-120c** (Context Isolation): "Scoping dispatched context to task-relevant information (vs full agent context) improves task success rate by ≥15%"

These are independent legs, so we can test them in parallel without interaction effects confounding results.

**Why these two?**
- P-120a (cooperation enforcement via model upgrade) requires swapping models — expensive and operationally risky
- P-120d (multiplicative compounding) requires all 3 fixes — save for after individual legs are validated
- P-120b and P-120c are testable with existing infrastructure at low cost

**Connections**: DD-731 (cooperation enforcement evidence), DD-732 (calibrated agreement evidence), DD-733 (context isolation evidence), KE-146, KE-147, H-097, EXP-146

---

## 2. Experimental Design Overview

### 2.1 Two-Track Design

| Track | Prediction | Method | Data Source |
|-------|-----------|--------|-------------|
| Track A | P-120b (Calibration) | Retrospective + Prospective | may.db `evaluations` table |
| Track B | P-120c (Context Isolation) | Prospective (gym) | Gym scenario runs |

Tracks run independently. Each has its own control/treatment, measurement, and falsification criteria.

---

## 3. Track A: Calibrated Agreement (P-120b)

### 3.1 Background

The `evaluations` table in may.db stores verification verdicts with fields: `sessionId`, `evaluatorModel`, `verdict` (pass/fail/partial), `issues`, `score`. Currently, verdicts are binary — the evaluator either passes or fails. There is no calibration mechanism to flag cases where the evaluator's confidence should be low.

**Conformal prediction** provides distribution-free coverage guarantees: given a calibration set of (verdict, ground-truth) pairs, we can construct prediction sets that contain the true label with probability ≥ 1-α.

### 3.2 Phase 1: Retrospective Analysis (Low Cost)

**Goal**: Establish the base rate of "wrong consensus" — cases where the verification verdict disagrees with a human review or with downstream outcomes.

**Protocol**:
1. Extract all evaluation records from may.db production data (request data export if local DB is empty)
2. Sample 50 sessions stratified by verdict (25 pass, 25 fail)
3. For each session, determine ground truth:
   - Did the session's deliverables actually work? (check git log for reverts, follow-up fixes)
   - Did a subsequent session correct errors missed by verification?
4. Compute:
   - **Wrong-consensus rate** = |{verdict ≠ ground_truth}| / N
   - **False-pass rate** = |{verdict=pass, ground_truth=fail}| / |{verdict=pass}|
   - **False-fail rate** = |{verdict=fail, ground_truth=pass}| / |{verdict=fail}|

**Expected baseline**: Wrong-consensus rate of 15-25% based on anecdotal evidence of verification misses.

### 3.3 Phase 2: Prospective Calibration Test

**Treatment condition**: Apply conformal prediction calibration to verification:
1. Use Phase 1 ground-truth labels as calibration set
2. For each new verification verdict, compute nonconformity score = |P(pass|features) - 0.5| (higher = more confident)
3. At α=0.10, construct prediction sets: if set = {pass, fail}, flag as "uncertain — needs human review"
4. Run 50 new verification sessions with calibration active

**Control condition**: 50 verification sessions with standard (uncalibrated) verdicts, run in the same time window.

**Assignment**: Alternate sessions — odd sessionIds get treatment, even get control.

**Measurement**:
- Primary: Wrong-consensus rate in treatment vs control
- Secondary: Fraction of "uncertain" flags (prediction set size > 1)
- Tertiary: Time cost of human review for flagged sessions

### 3.4 Track A Success/Failure Criteria

| Criterion | Threshold | Interpretation |
|-----------|-----------|----------------|
| **Success** | Wrong-consensus rate drops ≥30% (treatment vs control) | P-120b supported |
| **Partial support** | Wrong-consensus rate drops 15-29% | Calibration helps but less than predicted |
| **Failure** | Wrong-consensus rate drops <15% or increases | P-120b falsified |
| **Falsification** | Treatment wrong-consensus ≥ control wrong-consensus (p < 0.05) | Strong evidence against calibration benefit |

**Statistical test**: Two-proportion z-test. With baseline wrong-consensus rate of 20%, treatment target of 14% (30% reduction), N=50 per group:
- Effect size h = 0.32
- Power at α=0.05: ~62% (underpowered for subtle effects)
- For 80% power: need N=76 per group
- **Recommendation**: Run N=80 per group if feasible; accept lower power at N=50 if budget-constrained

### 3.5 Track A Falsification → H-097 Update

If Track A falsifies P-120b:
- H-097 posterior drops by ~0.15 (from 0.55 to ~0.40, below the 0.5 threshold)
- Interpretation: The "calibrated agreement" leg of CCC may not be independently valuable
- Next step: Test whether cooperation + context isolation alone are sufficient (modified H-097')

---

## 4. Track B: Context Isolation (P-120c)

### 4.1 Background

Currently, when agents are dispatched tasks via `call` or `message`, they receive:
- The task description
- Persistent context from `agents/<name>/context.md`
- Session context (recent history, checkpoints)
- Active recall (past failures)

P-120c predicts that **scoping context to task-relevant information** improves outcomes by reducing interference from irrelevant context that can cause:
- Distraction (attending to irrelevant recalled failures)
- Template displacement (KE-133/147: few-shot examples cause rote copying)
- Context window waste (filling the window with low-value information)

### 4.2 Protocol

**Treatment condition** (scoped context):
- Dispatch gym scenarios with only task-specific context:
  - The scenario description
  - Relevant skill files (matched by scenario type)
  - No active_recall block (or only recalls matching the scenario category)
- Implemented by creating a temporary `context.md` with scoped content

**Control condition** (full context):
- Dispatch gym scenarios with standard full context (as currently implemented)

**Scenario selection**: Use existing gym scenarios that have established baselines:
- Verification scenarios (5 scenarios × 10 runs each = 50 runs per condition)
- Plan-once-amend scenarios (if available, 5 × 10 = 50 runs per condition)

**Assignment**: Randomized — for each run, flip a coin (use deterministic seed for reproducibility) to assign treatment or control.

**Measurement**:
- Primary: **Task success rate** (binary: did the agent complete the scenario correctly?)
- Secondary: **Tool call count** (efficiency proxy)
- Tertiary: **Finish attempt count** (fewer = less flailing)
- Quaternary: **Time to completion**

### 4.3 Track B Success/Failure Criteria

| Criterion | Threshold | Interpretation |
|-----------|-----------|----------------|
| **Success** | Task success rate improves ≥15pp (treatment vs control) | P-120c supported |
| **Partial support** | Task success rate improves 8-14pp | Context isolation helps modestly |
| **Failure** | Task success rate improves <8pp | P-120c not supported at predicted magnitude |
| **Falsification** | Treatment success rate ≤ control success rate (p < 0.05, one-tailed) | Strong evidence that full context is better |

**Statistical test**: Two-proportion z-test. Assuming control baseline of 60% success rate, treatment target of 75% (15pp improvement):
- Effect size h = 0.32
- At N=50 per group: power ~62%
- At N=80 per group: power ~80%
- **Recommendation**: N=80 per group (8 scenarios × 10 runs each, or 5 scenarios × 16 runs)

### 4.4 Track B Implementation Notes

Context scoping requires modifying the dispatch mechanism. Options:
1. **Minimal**: Create scenario-specific `context.md` files and swap them before gym runs
2. **Moderate**: Add a `--scoped-context` flag to the gym runner that strips active_recall and limits context.md
3. **Full**: Build a context relevance scorer that dynamically selects which context items to include

For this experiment, Option 1 (minimal) is sufficient and avoids production changes.

### 4.5 Track B Falsification → H-097 Update

If Track B falsifies P-120c:
- H-097 posterior drops by ~0.15 (from 0.55 to ~0.40)
- Interpretation: Context isolation may not be the bottleneck — agents may benefit from broad context
- Alternative: The issue may be context *quality*, not context *scope*

---

## 5. Combined Analysis

### 5.1 Joint Outcomes Matrix

| Track A (Calibration) | Track B (Context Isolation) | H-097 Update | Next Step |
|----------------------|---------------------------|--------------|-----------|
| Success | Success | Prior → 0.75+ | Design EXP for P-120a or P-120d |
| Success | Failure | Prior → 0.50 | Investigate why context isolation failed |
| Failure | Success | Prior → 0.50 | Investigate why calibration failed |
| Failure | Failure | Prior → 0.30 | Major revision or retirement of H-097 |

### 5.2 Independence Check

Although we treat Tracks A and B as independent, we should verify this assumption:
- Compute correlation between Track A outcomes and Track B outcomes for any overlapping sessions
- If correlation > 0.3, the CCC legs may interact (which would actually support the "multiplicative" claim in P-120d)

---

## 6. Resource Estimates

| Resource | Track A Phase 1 | Track A Phase 2 | Track B | Total |
|----------|----------------|----------------|---------|-------|
| Sessions | 1-2 (data extraction + analysis) | 160 gym runs (80 per condition) | 160 gym runs | ~322 sessions |
| Cost | ~$0.20 | ~$16 (@$0.10/run) | ~$16 | ~$32 |
| Time | 1 session | 3-5 sessions | 3-5 sessions | ~10 sessions |
| Human review | 50 verdicts (Phase 1 ground truth) | Spot-check only | None | 50 reviews |

**Cost-optimization**: Run Track A Phase 1 first. If baseline wrong-consensus rate is <5%, calibration won't help much — skip Phase 2 and reallocate budget to Track B.

---

## 7. Data Collection Schema

### 7.1 Track A Results Table

```
experiment_id: "EXP-147-A"
session_id: TEXT
condition: "treatment" | "control"
verdict: "pass" | "fail" | "partial"
ground_truth: "pass" | "fail"
calibration_flag: "certain" | "uncertain" | NULL (control)
nonconformity_score: REAL | NULL (control)
prediction_set_size: INTEGER | NULL (control)
```

### 7.2 Track B Results Table

```
experiment_id: "EXP-147-B"
scenario_id: TEXT
run_number: INTEGER
condition: "scoped" | "full"
success: BOOLEAN
tool_calls: INTEGER
finish_attempts: INTEGER
elapsed_seconds: REAL
context_tokens: INTEGER (approximate)
```

---

## 8. Execution Plan

### Step 1: Track A Phase 1 — Retrospective baseline (1 session)
1. Export evaluation data from production may.db
2. Sample 50 sessions, determine ground truth
3. Compute baseline wrong-consensus rate
4. If rate < 5%, skip Track A Phase 2 → document finding

### Step 2: Track B Setup (1 session)
1. Select 8 gym scenarios with established baselines
2. Create scoped-context files for each scenario type
3. Write the randomization script (deterministic seed)
4. Run 5 pilot runs to verify setup works

### Step 3: Track A Phase 2 + Track B Full Run (3-5 sessions)
1. Run Track A prospective calibration experiment (160 sessions)
2. Run Track B context isolation experiment (160 sessions)
3. Tracks run in parallel (independent)

### Step 4: Analysis (1 session)
1. Compute primary metrics for both tracks
2. Run statistical tests
3. Update H-097 posterior based on joint outcomes matrix
4. Write results file: `EXP-147/results.md`

---

## 9. Pre-registration

**This design is pre-registered before data collection begins.**

- Primary metrics: wrong-consensus rate (Track A), task success rate (Track B)
- Statistical tests: two-proportion z-test, α=0.05, one-tailed
- Sample sizes: N=80 per group per track (target), N=50 minimum
- Falsification thresholds: as specified in sections 3.4 and 4.3
- No post-hoc metric changes after data collection begins

---

## 10. Connections

- **Tests**: H-097 predictions P-120b, P-120c
- **Evidence base**: DD-731 (cooperation), DD-732 (calibration), DD-733 (context isolation)
- **Related experiments**: EXP-146 (thinking-token calibration — related calibration methodology)
- **Knowledge entries**: KE-146 (thinking-token patterns), KE-147 (few-shot displacement)
- **If successful, enables**: EXP for P-120d (multiplicative compounding test)
- **If failed, triggers**: H-097 revision or retirement
