# EXP-147: CCC Triad Internal Validation — Calibration & Context Isolation

**Status**: Track A Phase 1 COMPLETE (Phase 2 skipped per §6 — baseline < 5%). Track B Phase 0 COMPLETE — ready for Phase 1.  
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

## 4. Track B: Context Isolation (P-120c) — REFINED EXECUTABLE DESIGN

**Status**: Ready for Coach execution  
**Refined**: 2026-04-12  
**Budget**: ~160 runs × $0.10 = ~$16 (reallocated from Track A Phase 2)

### 4.1 Background & Operationalization

**What "context isolation" means operationally**: When an agent is dispatched a task, the system injects several context blocks into its session prompt:

| Context Block | Source | Typical Size | Task-Relevant? |
|---|---|---|---|
| Task description | Caller | 200-500 tokens | ✅ Always |
| `agents/<name>/context.md` | Persistent file | 2,000-5,000 tokens | ⚠️ Partially (mix of global + task-specific) |
| Active recall (past failures) | DB query | 1,000-8,000 tokens | ⚠️ Often irrelevant to current task |
| Session history/checkpoints | Runtime | 500-3,000 tokens | ❌ Usually irrelevant for fresh tasks |
| Recent task history | Runtime | 500-2,000 tokens | ❌ Usually irrelevant |

P-120c predicts that **removing the irrelevant blocks** improves task success by ≥15pp, because:
- **Distraction**: Irrelevant active_recall entries cause the agent to optimize for avoiding past failures rather than solving the current task (see: Bob's active_recall block with 30+ failure warnings — many unrelated to any given task)
- **Template displacement**: KE-133/KE-147 showed few-shot examples cause -67pp on discovery tasks by triggering rote pattern-matching instead of first-principles reasoning
- **Context window waste**: DD-706 (RIFT) showed 72% accuracy drop from prompt reordering alone — excess context degrades attention allocation even if not actively harmful
- **Theoretical support**: DD-733 (DACS) showed 30-70pp improvement from context isolation in multi-agent orchestration (90-98% vs 21-60% baseline)

### 4.2 Experimental Design

#### 4.2.1 Two Conditions

**Control (full context)** — Run gym scenarios exactly as the system currently does:
- Full `agents/bob/context.md` injected
- Full active_recall block (all past failures)
- Standard session history
- No modifications to the dispatch pipeline

**Treatment (scoped context)** — Run the same scenarios with context stripped to task-relevant items only:
- `context.md` replaced with a **minimal version** containing only:
  - Environment facts (bun path, npx unavailability, project root = /app)
  - The specific skill file matching the scenario category (if any)
  - No research context, no hypothesis tracking, no cross-agent updates
- **No active_recall block** (or at most 2-3 recalls matching the scenario's failure category)
- No session history or checkpoints from prior sessions
- Task description identical to control

#### 4.2.2 Implementation Mechanism

The gym runner reads `task.md` from the scenario directory and passes it to the agent. Context injection happens at the **system prompt level** via the agent's `context.md` and runtime context assembly. To implement the two conditions:

**Step 1**: Create two context files:
- `agents/shared/knowledge/experiments/EXP-147/context-full.md` — snapshot of current `agents/bob/context.md` (frozen at experiment start for consistency)
- `agents/shared/knowledge/experiments/EXP-147/context-scoped.md` — minimal context (see §4.2.3)

**Step 2**: For each gym run:
1. Back up `agents/bob/context.md`
2. Copy the appropriate context file (full or scoped) to `agents/bob/context.md`
3. Run the gym scenario: `node runner.js <scenario> --agent bob --timeout 5`
4. Record the result
5. Restore the original context.md

**Step 3**: To control active_recall, set environment variable `DISABLE_ACTIVE_RECALL=1` for treatment runs (if the runtime supports this), OR clear the failure tracking DB entries temporarily. If neither is feasible, document this as a limitation and measure active_recall token count as a covariate.

**Alternative (simpler)**: If context.md swapping is fragile, use the `injected_context` field in `scenario.json` — create treatment variants of each scenario that inject a scoped context preamble overriding the system context. This is cleaner but requires duplicating scenarios.

#### 4.2.3 Scoped Context Contents (Treatment)

```markdown
# Agent Context (Scoped for EXP-147)
- bun is at .state/.bun/bin/bun — add to PATH: `export PATH=".state/.bun/bin:$PATH"`
- npx is not available in this environment — use ./node_modules/.bin/<tool> or bun x <tool>
- Project root is /app — do not use /home/*, /Users/*, /root/*, or ~/ paths
- agents/ is a separate git repo — commit from agents/ dir, not project root
- When calling finish(), status must match reality — if you found missing files or blockers, use 'blocked' or 'partial', not 'success'
```

That's ~100 tokens. Compare to full context.md at ~2,000-5,000 tokens. The scoped version retains only **environment facts that any task needs** and strips all research context, turn discipline rules, knowledge base paths, and historical insights.

#### 4.2.4 Scenario Selection

Select 8 scenarios from different categories to avoid category-specific confounds. Requirements:
- Must have established baselines (at least 3 prior runs in gym_runs DB)
- Must span at least 3 different categories
- Must include scenarios of varying difficulty (mix of pass rates 30-90%)

**Candidate scenarios** (8 selected from existing pool, grouped by category):

| # | Scenario | Category | Est. Baseline | Why Selected |
|---|----------|----------|---------------|--------------|
| 1 | `read-before-edit` | verification | ~60% | Core skill, context-sensitive |
| 2 | `convention-verify-edit` | verification | ~65% | Verification discipline task |
| 3 | `plan-once-amend` | judgment | ~50% | Planning task, context matters |
| 4 | `hidden-dependency` | debugging | ~55% | Requires focus, not context |
| 5 | `cascading-fix-trap-v2` | debugging | ~40% | Complex, context could distract |
| 6 | `stale-approach-fixation` | judgment | ~45% | Pivoting skill, context could anchor |
| 7 | `misleading-stacktrace` | debugging | ~55% | Requires investigation focus |
| 8 | `contradictory-requirements` | judgment | ~50% | Requires clear thinking |

**Backup scenarios** (if any candidate has <3 baseline runs):
- `silent-dependency`, `wrong-fix-recovery`, `partial-verification-trap`, `sunk-cost-escape`

**Final selection**: Coach should verify baseline availability in gym_runs DB and substitute from backups if needed. Report final selection before starting the main experiment.

#### 4.2.5 Run Allocation

- **N = 80 per condition** (target), **N = 50 minimum** (if budget-constrained)
- 8 scenarios × 10 runs each = 80 runs per condition
- Total: 160 runs
- **Randomization**: For each (scenario, run_number) pair, assign condition using:
  ```
  condition = SHA256(scenario_name + run_number + "EXP147B") mod 2
    0 → control (full context)
    1 → treatment (scoped context)
  ```
  This is deterministic and reproducible. Each scenario gets ~5 control + ~5 treatment runs (expected; actual varies by hash).

#### 4.2.6 Execution Protocol for Coach

**Phase 0: Setup (1 session)**
1. Snapshot current `agents/bob/context.md` → save as `EXP-147/context-full.md`
2. Create `EXP-147/context-scoped.md` per §4.2.3
3. Verify 8 scenarios exist and have baselines: `node runner.js --list` and check gym_runs DB
4. Substitute from backup list if any scenario has <3 prior runs
5. Generate the 160-run assignment table using the SHA256 formula
6. Run 4 pilot runs (2 control, 2 treatment on different scenarios) to verify the context-swap mechanism works
7. Report: scenario list, assignment table, pilot results

**Phase 1: Main Execution (3-4 sessions)**
1. For each run in the assignment table:
   a. Swap context.md to the appropriate version (full or scoped)
   b. Run: `node runner.js <scenario> --agent bob --timeout 5`
   c. Record: scenario, run_number, condition, passed (boolean), duration, any errors
   d. Restore context.md
2. Process in batches of ~40-50 runs per session
3. After each batch, save intermediate results to `EXP-147/raw-data/track-b-batch-N.json`
4. If a scenario consistently crashes (>3 consecutive failures in both conditions), skip it and substitute from backup

**Phase 2: Analysis (1 session)**
1. Aggregate all results
2. Compute primary and secondary metrics (§4.3)
3. Run statistical tests
4. Write results to `EXP-147/results.md` (append Track B section)
5. Update H-097 per §4.5

### 4.3 Metrics & Pass/Fail Criteria

#### 4.3.1 Primary Metric
**Task success rate** = (# scenarios passed) / (# scenarios run) per condition

#### 4.3.2 Secondary Metrics
- **Tool call count**: Mean tool calls per run (lower = more efficient)
- **Finish attempt count**: Mean finish() calls per run (fewer = less flailing)
- **Duration**: Mean seconds per run
- **Context tokens**: Approximate token count of injected context per condition (measured once, not per-run)

#### 4.3.3 Success/Failure Criteria

| Criterion | Threshold | Interpretation |
|-----------|-----------|----------------|
| **Strong support** | Treatment success rate ≥15pp higher than control (p < 0.05) | P-120c supported at predicted magnitude |
| **Moderate support** | Treatment success rate 8-14pp higher (p < 0.10) | Context isolation helps but less than predicted |
| **Null result** | Treatment success rate within ±7pp of control (p > 0.10) | P-120c not supported — context isolation doesn't help |
| **Falsification** | Control success rate >8pp higher than treatment (p < 0.05) | Strong evidence AGAINST context isolation — full context is better |

**Statistical test**: Two-proportion z-test, one-tailed (H₁: treatment > control).
- Assuming control baseline ~55% (conservative), treatment target 70% (15pp improvement)
- Effect size h ≈ 0.31
- At N=80 per group: power ≈ 78% (acceptable)
- At N=50 per group: power ≈ 58% (underpowered — note as limitation)

**Per-scenario analysis**: Also compute per-scenario treatment effect to identify which task types benefit most from context isolation. This is exploratory (not pre-registered), but informative for theory refinement.

### 4.4 Confounds & Mitigations

| Confound | Risk | Mitigation |
|----------|------|------------|
| **Temporal drift** | Runs at different times may face different server loads | Interleave conditions — don't run all control first |
| **Context.md staleness** | Production context.md may be edited during experiment | Freeze both versions at experiment start |
| **Active recall not controllable** | If runtime injects active_recall regardless of context.md | Measure recall token count as covariate; report as limitation |
| **Scenario-specific effects** | Some scenarios may benefit, others may not | Per-scenario analysis; diverse scenario selection |
| **Agent state persistence** | Prior runs may leave state that affects later runs | Gym runner uses temp directories; agent context is swapped fresh |
| **Learning effects** | Model may not learn across runs (no weight updates), but system-level context may accumulate | Clear checkpoints between runs if feasible |

### 4.5 What This Test Can and Cannot Show

**Can show**:
- Whether reducing injected context improves task success on isolated gym scenarios
- Which task categories benefit most from context scoping
- The magnitude of the context isolation effect in our specific system

**Cannot show**:
- Whether DACS-style dynamic scoping (DD-733) works — we're testing static scoping only
- Whether the effect generalizes to production (gym ≠ production per CR-326)
- Whether the effect compounds with other CCC legs (that's P-120d, a separate experiment)

**Interpretation note**: A null result does NOT mean DD-733 is wrong. Our test uses static context reduction on single-agent gym tasks, while DD-733 tested dynamic scoping on multi-agent orchestration. A null result would mean our specific context pollution isn't severe enough to matter on these tasks, OR that gym scenarios don't have enough context sensitivity to detect the effect.

### 4.6 Track B Falsification → H-097 Update

| Result | H-097 Posterior | Reasoning |
|--------|----------------|-----------|
| **Strong support** (≥15pp, p<0.05) | 0.55 → 0.65 | Context isolation leg validated internally; CCC triad gains evidence |
| **Moderate support** (8-14pp, p<0.10) | 0.55 → 0.60 | Directional evidence; effect smaller than predicted |
| **Null result** (±7pp) | 0.55 → 0.50 | Context isolation leg not validated; triad weakened but not falsified |
| **Falsification** (control > treatment, p<0.05) | 0.55 → 0.40 | Context isolation is counterproductive; this leg of CCC triad likely wrong |

### 4.7 Key Design Decisions & Rationale

1. **Static scoping, not dynamic DACS**: DACS requires orchestrator-level changes; static context reduction is testable immediately with gym infrastructure. This is a weaker test of context isolation but a feasible first step.

2. **Context.md swap, not scenario duplication**: Swapping the agent's context.md before each run is simpler than creating 16 scenario variants (8 × 2 conditions). Tradeoff: requires careful restore logic.

3. **8 scenarios × 10 runs vs 5 × 16**: 8 scenarios provides better category diversity, reducing the risk that results are driven by one scenario type.

4. **SHA256 randomization**: Deterministic assignment enables exact replication. The hash distributes ~50/50 without needing a random seed file.

5. **N=80 target**: Provides ~78% power at 15pp effect size. This is the minimum defensible sample size. Running fewer would risk a type II error on a genuinely effective intervention.

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

## 6. Resource Estimates (Updated post-Track A)

| Resource | Track A Phase 1 | Track A Phase 2 | Track B | Total |
|----------|----------------|----------------|---------|-------|
| Sessions | 1-2 (DONE) | SKIPPED | 5-6 (setup + 3-4 execution + analysis) | ~7-8 sessions |
| Gym runs | 0 | 0 | 160 (80 per condition) | 160 runs |
| Cost | ~$0.20 (DONE) | $0 | ~$16 (@$0.10/run) | ~$16.20 |
| Time | 1 session (DONE) | - | 5-6 sessions | ~6-7 sessions |
| Human review | 50 verdicts (DONE) | - | None | 50 reviews (done) |

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

### Step 2: Track B Setup — Context Isolation (1 session)
1. Snapshot `agents/bob/context.md` → `EXP-147/context-full.md`
2. Create `EXP-147/context-scoped.md` per refined §4.2.3
3. Verify 8 candidate scenarios have baselines in gym_runs DB; substitute from backup list if needed
4. Generate 160-run assignment table (SHA256 deterministic randomization)
5. Run 4 pilot runs (2 control, 2 treatment) to validate context-swap mechanism
6. Report: final scenario list, assignment table, pilot results

### Step 3: Track B Full Run (3-4 sessions)
1. Execute 160 gym runs (80 per condition) per §4.2.6 Phase 1
2. Process in batches of ~40-50 runs per session, interleaving conditions
3. Save intermediate results to `EXP-147/raw-data/track-b-batch-N.json` after each batch

### Step 4: Track B Analysis (1 session)
1. Aggregate all results from batch files
2. Compute primary metric (task success rate per condition) and secondary metrics
3. Run two-proportion z-test per §4.3.3
4. Compute per-scenario treatment effects (exploratory)
5. Update H-097 posterior per §4.6
6. Write Track B results to `EXP-147/results.md` (append to existing Track A results)

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
