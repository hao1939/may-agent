# EXP-151: Difficulty-Threshold Moderation of Overhead Effects

**Status**: Phase 1 In Progress — Easy & Hard bucket trials running  
**Hypothesis**: H-107 (Difficulty Threshold Hypothesis)  
**Predecessor**: EXP-149 (overhead measurement — motivated H-107 via KE-158)  
**Created**: 2026-04-12  
**Priority**: Tier 1 — tests highest-priority active hypothesis

---

## 1. Research Question

Does task difficulty moderate the effect of overhead (guards, workflows, structured output) on agent performance? Specifically, does overhead help on easy tasks, hurt on medium-difficulty tasks, and have neutral/negative effects on hard tasks (the "inverted-U" interaction predicted by H-107)?

## 2. Hypothesis Under Test

**H-107** predicts a difficulty × overhead interaction:
- **Easy tasks** (>70% baseline pass rate): Overhead helps — prevents careless errors without consuming significant cognitive budget
- **Medium tasks** (40–60% baseline): Overhead hurts — resource competition between guard compliance and problem-solving at the critical threshold
- **Hard tasks** (<30% baseline): Overhead is neutral — tasks fail regardless due to fundamental capability limits

The key mechanism is **resource competition**: overhead consumes a fixed portion of the agent's effective context/attention budget. When the task itself demands most of that budget (medium difficulty), overhead pushes the agent past a tipping point.

## 3. Experimental Design

### 3.1 Design Type
**3 × 2 factorial design** (between-subjects per cell):
- **Factor A — Task Difficulty**: Easy / Medium / Hard (3 levels)
- **Factor B — Overhead Condition**: Minimal / Full (2 levels)
- **Cells**: 6 total

### 3.2 Difficulty Buckets

Tasks are classified by **baseline pass rate** (measured under minimal-overhead conditions in prior experiments or calibration runs):

| Bucket | Baseline Pass Rate | Defining Characteristic |
|--------|-------------------|------------------------|
| Easy   | >70%              | Agent reliably solves; errors are careless/procedural |
| Medium | 40–60%            | Agent succeeds roughly half the time; requires sustained reasoning |
| Hard   | <30%              | Agent rarely succeeds; fundamental capability limit |

### 3.3 Selected Scenarios (Phase 0 Calibration Complete)

See `phase0-calibration.md` for full data compilation and methodology.

**Easy bucket (>70% baseline):**
- `mock-leak-trap` — 100% (8/8), code debugging (test mocking)
- `investigate-fix-pattern` — 89% (8/9), investigation + code fix
- `wrong-fix-recovery` — 78% (7/9), error recovery from wrong approach

**Medium bucket (40–60% baseline) — REVISED after Phase 0b calibration:**
- `contradictory-requirements-ext-3unrelated` — 50% (4/8), contradiction detection with distractors
- `contradictory-requirements-ext-4gate` — 67% (4/6), contradiction detection (gate variant) ⚠️ borderline high
- `kb-integration-discovery-fewshot` — 33% (2/6), KB file discovery ⚠️ borderline low

> **Pre-calibration selection** (replaced — see phase0-calibration.md §7–8 for details):
> - `sycophants-dilemma` — 50% (3/6) — no gym_runs data, EXP-044 only
> - `escalation-impossible-task` — 40% (2/5) → actual gym rate 0/11 (0%), moved to Hard
> - `behavior-escalation-stubborn` — 50% (2/4) → regime change to 100%, ceiling

**Hard bucket (<30% baseline) — REVISED after Phase 0b calibration:**
- `contradictory-requirements` — 0% (0/12 gym_runs), deep reasoning (contradiction detection)
- `escalation-impossible-task` — 0% (0/11 gym_runs), feasibility assessment (moved from Medium)
- `context-proof-build-xref` — 0% (0/6 gym_runs), cross-reference discovery

> **Calibration status**: Phase 0 COMPLETE (2026-04-12). All scenarios confirmed via gym_runs data. Medium bucket is fragile (only M1 cleanly in 40–60% range). See phase0-calibration.md §7–9 for full details.

### 3.4 Overhead Conditions

| Condition | Description |
|-----------|-------------|
| **Minimal** | No guards, no forced workflows, no structured output requirements. Agent receives task and works freely. Basic system prompt only. |
| **Full** | Production stack: verification guards (FM-3.3), read-before-edit guards, structured finish() requirements, workflow phases, budget limits. Matches current operational configuration. |

**Implementation**:
- **Full overhead**: `scripts/gym-run.sh <scenario> --agent coder` (standard — uses production SOUL.md with all skills/guards)
- **Minimal overhead**: `scripts/gym-run.sh <scenario> --agent coder --lab coder-minimal-exp096` (lab fork with stripped SOUL.md, no skills directory)
- The `coder-minimal-exp096` fork contains only a minimal SOUL.md (~12 lines: identity, basic methodology, minimal constraints) and inherits `agent.json` from the base coder agent

The contrast must be clean: minimal = remove ALL overhead, not just some. Partial-overhead conditions are a follow-up experiment (EXP-152 candidate).

### 3.5 Sample Size

**N = 30 per cell** (6 cells × 30 = **180 total trials**)

Power analysis rationale:
- Expected effect size: medium (Cohen's d ≈ 0.5) based on EXP-149 preliminary data showing ~15–20pp pass rate differences
- For a chi-squared test of independence on 3×2 table: N=180 gives ~80% power to detect medium interaction effects at α=0.05
- For per-bucket pairwise comparisons (overhead vs. minimal): N=30/cell gives ~75% power for 20pp differences in proportions

**Cost estimate**: At $0.05–0.15 per trial → $9–$27 total. Acceptable.

## 4. Procedure

### Phase 0: Calibration (if needed)
1. Select 3 candidate scenarios per difficulty bucket
2. Run N=20 calibration trials per scenario under minimal overhead
3. Confirm baseline pass rates fall within bucket ranges
4. Select 1–2 scenarios per bucket for main experiment

### Phase 1: Main Experiment
1. For each of the 6 cells (difficulty × overhead):
   - Run N=30 independent trials
   - Randomize trial order within and across cells
   - Record: pass/fail, token count, tool call count, time-to-completion, error types
2. Run in blocks to control for temporal effects (e.g., API variability)

### Phase 2: Analysis
1. Primary analysis (see §5)
2. Exploratory: examine error type distributions, token usage patterns
3. Write results entry (KE-159 or similar)

## 5. Statistical Analysis Plan

### 5.1 Primary Test
**Cochran-Mantel-Haenszel test** or **logistic regression with interaction term**:

```
logit(pass) = β₀ + β₁(difficulty) + β₂(overhead) + β₃(difficulty × overhead) + ε
```

- **Primary interest**: β₃ (the interaction term). If significant (p < 0.05), difficulty moderates overhead effects.
- Difficulty coded as ordered factor (Easy=1, Medium=2, Hard=3) or as dummy variables for non-linear patterns.

### 5.2 Planned Contrasts (maps to H-107 predictions)

| Prediction | Test | Expected Result |
|-----------|------|-----------------|
| **P-107a**: Overhead helps easy tasks | Easy: Full vs Minimal pass rate | Full > Minimal (one-tailed z-test, p<0.05) |
| **P-107b**: Overhead hurts medium tasks | Medium: Full vs Minimal pass rate | Full < Minimal (one-tailed z-test, p<0.05) |
| **P-107c**: Overhead neutral on hard tasks | Hard: Full vs Minimal pass rate | \|Full − Minimal\| < 10pp (equivalence test, TOST) |
| **P-107d**: Largest negative delta at medium | Compare deltas across buckets | Medium delta < Easy delta AND Medium delta < Hard delta |
| **P-107e**: ~50% baseline = maximum overhead cost | Plot delta vs baseline rate | Peak negative delta near 40–60% baseline |

### 5.3 Secondary Metrics
- **Token usage**: Does overhead increase token consumption uniformly, or more at medium difficulty?
- **Tool call count**: Proxy for "flailing" — expected to increase under overhead at medium difficulty
- **Error taxonomy**: Classify failures as procedural (guard-related) vs. substantive (wrong approach). H-107 predicts overhead shifts error types toward procedural at medium difficulty.

### 5.4 Falsification Criteria
H-107 is **falsified** if:
- The interaction term β₃ is non-significant AND planned contrasts show no inverted-U pattern
- OR overhead uniformly helps (or hurts) across all difficulty levels
- OR the maximum overhead cost occurs at easy or hard, not medium

H-107 is **supported** if:
- Significant interaction (p < 0.05) in the predicted direction
- At least 3 of 5 planned contrasts confirm predictions
- Effect sizes are practically meaningful (>10pp differences where predicted)

## 6. Threats to Validity

| Threat | Mitigation |
|--------|-----------|
| **Scenario confounds**: Difficulty buckets differ in task type, not just difficulty | Select scenarios that vary difficulty within similar task types where possible |
| **Overhead definition**: "Minimal" still has some system prompt overhead | Document exact prompts for both conditions; acknowledge floor |
| **Learning effects**: Agent may improve across trials | Randomize order; analyze for temporal trends |
| **Baseline drift**: Model behavior may change over time | Run all cells within a tight time window (same day/week) |
| **Multiple comparisons**: 5 planned contrasts inflate Type I error | Apply Holm-Bonferroni correction; pre-register contrasts |
| **Difficulty misclassification**: Scenarios may not have stable baseline rates | Calibration phase (Phase 0) addresses this |

## 7. Connection to Knowledge Base

- **H-107**: Direct test of all 5 predictions (P-107a through P-107e)
- **KE-158**: Grounding knowledge entry — difficulty threshold model that motivated this design
- **EXP-149**: Predecessor — provided the overhead measurements that revealed the difficulty interaction
- **H-106**: If EXP-151 supports H-107, H-106 (overhead narrative) is subsumed as the easy-task special case
- **KE-091**: Alignment tax insight — EXP-151 quantifies when the tax is worth paying

## 8. Decision Rules

After EXP-151 completes:
- **If H-107 supported**: Update PRIORITY-TRACKER (H-107 confirmed), propose operational changes (reduce overhead for medium-difficulty tasks), design EXP-152 for partial-overhead gradient
- **If H-107 falsified**: Demote H-107, revisit KE-158 assumptions, consider alternative models (e.g., overhead always helps/hurts linearly)
- **If mixed results**: Identify which predictions held, refine H-107 boundaries, design targeted follow-up

## 9. Resource Requirements

- **Compute**: 180 gym trials × ~2 min each ≈ 6 hours of sequential runtime (parallelizable)
- **Cost**: $9–$27 estimated
- **Human oversight**: Scenario selection review, calibration sign-off
- **Timeline**: 1–2 days for execution, 1 day for analysis
