# KE-171: Difficulty Calibration — Predicting Experimental Signal from Baseline Pass Rates

**Source**: DD-753 (ZPD convergence), EXP-152 (88 trials, ceiling), EXP-144 (50 trials, ceiling), EXP-151 (159 trials, inconclusive), scenario baseline census  
**Confidence**: High (mathematical foundation + empirical confirmation across 297 experiment trials)  
**Created**: 2026-04-13  

---

## Finding

The experimental signal from any intervention (skill, guard, context, format change) follows a **bell curve** over the scenario's baseline pass rate. Maximum signal occurs at **p ≈ 0.50** (50% baseline). Signal collapses at both extremes — ceiling (p > 0.85) and floor (p < 0.15). This is not a heuristic; it's derivable from the Beta(2,2) kernel proven optimal in DD-753's PACED framework.

**The practical consequence**: ~60% of our gym scenarios are experimentally useless. They sit at ceiling (100%) or floor (0%), where no intervention can produce detectable effects. Every experiment that ignores this wastes $5-10 on uninformative trials.

## The Mathematical Foundation

From DD-753's synthesis of 5 independent research groups:

```
Signal strength ∝ p(1-p)    where p = baseline pass rate

Maximum signal:  p = 0.50  →  signal = 0.250
Good signal:     p = 0.35 or 0.65  →  signal ≥ 0.200
Weak signal:     p = 0.15 or 0.85  →  signal = 0.128
No signal:       p < 0.05 or p > 0.95  →  signal < 0.048
```

More precisely, for an intervention with overhead cost `c` (proportion of agent capacity consumed):

```
Net value of intervention = B(p) - c  where B(p) = p(1-p)
Intervention detectable when p ∈ [p_low, p_high]:
  p_low  = (1 - √(1-4c)) / 2
  p_high = (1 + √(1-4c)) / 2
```

Example: an intervention that consumes 10% of agent capacity (c = 0.10) is only detectable when p ∈ [0.11, 0.89]. At p = 0.95 (ceiling) or p = 0.05 (floor), the intervention is literally unmeasurable.

## Difficulty Zones — Our Scenario Census

As of 2026-04-13, across all production gym scenarios with n ≥ 3:

### 🔴 Dead Zone: Floor (0-15%, ~12 scenarios)
**No upward signal possible — base model fundamentally cannot do these tasks.**

| Scenario | Rate | n |
|----------|------|---|
| cascading-fix-trap-v2 | 0% | 41 |
| contradictory-requirements (original) | 0% | 48 |
| escalation-impossible-task | 0% | 14 |
| mock-leak-trap | 0% | 11 |
| wrong-fix-recovery | 0% | 5 |
| read-before-edit | 4.3% | 23 |
| Various contradictory-requirements variants | 0% | 6-8 each |

**Exception**: Floor scenarios ARE useful when testing **counter-intuitive skills** — if the skill teaches a behavior the model doesn't have, moving from 0% to >0% is the signal (EXP-153's design exploits this). But you're testing the skill, not comparing two conditions at floor.

### 🟡 Marginal Zone: Low (15-35%, ~3 scenarios)
**Weak signal — need large N (≥40/cell) for detection. Easy to confuse with noise.**

| Scenario | Rate | n |
|----------|------|---|
| exp144-hidden-dep-decoupled | 15% | 20 |
| kb-integration-discovery-fewshot | 20% | 10 |

### 🟢 Sweet Spot: Medium (35-70%, ~7 scenarios)
**Maximum experimental signal — design experiments HERE.**

| Scenario | Rate | n | Signal p(1-p) |
|----------|------|---|---------------|
| contradictory-requirements-combined | 46.2% | 13 | 0.249 |
| behavior-escalation-stubborn | 46.4% | 28 | 0.249 |
| kb-discovery-hints-126 | 50.0% | 12 | **0.250** |
| kb-discovery-baseline-126 | 53.3% | 15 | 0.249 |
| conflicting-evidence | 53.6% | 28 | 0.249 |
| contradictory-requirements-ext-3unrelated | 61.5% | 13 | 0.237 |
| contradictory-requirements-ext-4gate | 66.7% | 6 | 0.222 |

These 7 scenarios are our **experimental workhorses**. All other scenarios are informational or require special justification.

### 🟡 Marginal Zone: High (70-85%, ~2 scenarios)
**Detectable signal but biased — improvements show up but decrements are hard to detect.**

| Scenario | Rate | n |
|----------|------|---|
| optimize-deploy-config | 72.7% | 11 |
| contradictory-requirements-ext-2gate | 83.3% | 6 |

### 🔴 Dead Zone: Ceiling (85-100%, ~20+ scenarios)
**No signal possible — base model already succeeds. Any intervention measures to zero.**

Includes: convention-verify-edit (91.1%), plan-once-amend (96%), misleading-stacktrace (97.5%), and 15+ scenarios at 100%.

EXP-152 spent 88 trials and $8.80 confirming this: removing skills from ceiling scenarios produces identical results.

## Rules for Experiment Designers

### Rule 1: Check Baseline BEFORE Designing
**Mandatory pre-check**: Query `gym_runs` for the target scenario's production pass rate. If it's outside [0.30, 0.75], provide explicit justification or choose a different scenario.

```sql
SELECT scenario, COUNT(*) as n,
       ROUND(AVG(CASE WHEN passed=1 THEN 1.0 ELSE 0.0 END)*100, 1) as rate
FROM gym_runs WHERE lab_fork IS NULL OR lab_fork = ''
GROUP BY scenario HAVING COUNT(*) >= 5
ORDER BY rate;
```

### Rule 2: Re-calibrate Before Running
**Critical lesson from EXP-152**: Baselines drift. `behavior-escalation-stubborn` was 0% historically but shifted to 100% on recent runs. `convention-verify-edit` was 87.9% historically but is 100% recently.

**Phase 0 calibration protocol**: Run 3-5 fresh production trials of each target scenario. If the rate has drifted to >85% or <15%, STOP and reselect.

### Rule 3: Use the Signal Formula for Power Analysis
Standard power analysis assumes you know the expected effect size. The ZPD model gives you a ceiling on detectable effects:

```
Maximum detectable effect ≈ 2 × √(p(1-p)/N)  (approximate 95% CI half-width)

At p = 0.50, N = 20:  max detectable ≈ 22pp  ✓ reasonable
At p = 0.50, N = 50:  max detectable ≈ 14pp  ✓ precise
At p = 0.90, N = 20:  max detectable ≈ 13pp  ⚠️ only detects large effects
At p = 0.95, N = 20:  max detectable ≈ 10pp  ❌ and only 5pp of room above
At p = 0.50, N = 10:  max detectable ≈ 32pp  ⚠️ only detects massive effects
```

### Rule 4: Match Scenario to Intervention
The failure mode tested by the scenario must match the behavior targeted by the intervention:
- Testing a verification skill → use a scenario where verification failures are the failure mode
- Testing context scoping → use a scenario where context overload causes failures
- Mismatch wastes trials: EXP-152's kb-discovery-baseline-126 didn't test verification behavior

### Rule 5: Floor Scenarios Have a Special Use
Floor (0%) scenarios are experimentally useful ONLY when:
- You're testing whether a new capability (skill, tool, workflow) enables a previously-impossible behavior
- The prediction is 0% → >0%, not comparing two non-zero rates
- Example: EXP-153 tests whether an escalation skill can move escalation-impossible-task from 0% to >30%

## Predictions for Active Experiments

### EXP-153: Should Yield Signal ✓
- `escalation-impossible-task` (0%): Floor scenario, but testing capability injection — appropriate
- `contradictory-requirements-ext-3unrelated` (61.5%): In the sweet spot — high-signal zone

**Prediction**: If the escalation skill works at all, the 0% → >0% jump is trivially detectable even at N=10. The contradictory-requirements scenario at 61.5% gives p(1-p) = 0.237, excellent signal — a 15pp effect is detectable at N=25/cell.

### EXP-144 Phase 2: Needs Harder Scenarios
EXP-144 Phase 1 used scenarios at ceiling (hidden-dependency 100%, compound-edit 100%). Phase 2 should use:
- `conflicting-evidence` (53.6%, n=28) — good signal, complex task
- `contradictory-requirements-combined` (46.2%, n=13) — requires analytical reasoning

### EXP-150 (proposed H-107 test): Scenario Selection Critical
The proposed 6-scenario design needs:
- 2 easy: `optimize-deploy-config` (72.7%) — actually this is marginal, not easy. True easy scenarios are all at 100%, which creates the same dead zone problem
- 2 medium: `conflicting-evidence` (53.6%), `kb-discovery-baseline-126` (53.3%) ✓
- 2 hard: `read-before-edit` (4.3%), `cascading-fix-trap-v2` (0%) — these are floor, not "hard"

**Problem**: We lack scenarios in the 15-35% and 75-85% ranges. Our scenario distribution is bimodal — clustered at floor (0%) and ceiling (85-100%), with a thin band at medium (40-65%). This makes testing the full difficulty curve nearly impossible without creating new scenarios.

## The Bimodal Scenario Problem

Our scenario portfolio has a structural issue that undermines difficulty-stratified experiments:

```
Distribution of scenarios by baseline pass rate:
  0-10%:   ~14 scenarios  ████████████████  (floor cluster)
 10-30%:    ~3 scenarios  ████
 30-50%:    ~3 scenarios  ████
 50-70%:    ~4 scenarios  █████
 70-85%:    ~2 scenarios  ███
 85-100%:  ~20 scenarios  ████████████████████████  (ceiling cluster)
```

This bimodality means:
1. **Most experiments run into ceiling effects** — because most available scenarios are at ceiling
2. **We can't test the full H-107 curve** — we lack gradations between 10-30% and 70-85%
3. **The "sweet spot" scenarios are overused** — the 7 medium-difficulty scenarios bear the load of all experiments

**Recommendation**: Invest in scenario development targeting the 20-40% and 70-85% ranges. Consider creating "difficulty-tuned" variants of existing scenarios (e.g., adding complexity to easy scenarios, providing hints for hard ones).

## Cross-References

| Entry | Relationship |
|-------|-------------|
| **DD-753** | Mathematical foundation — Beta(2,2) kernel, ZPD convergence |
| **H-107** | Parent hypothesis — difficulty moderates overhead effectiveness |
| **KE-170** | Complementary — skills redundant at ceiling (this entry explains why ceiling is uninformative) |
| **KE-010** | Predecessor — identified ceiling effects as a problem; KE-171 provides the theory and thresholds |
| **EXP-152** | Primary evidence — 88 trials proving ceiling uninformative |
| **EXP-144** | Supporting evidence — 50 trials with ceiling effect on product accuracy |
| **EXP-151** | Supporting evidence — bimodal scenario distribution caused easy=uninformative, hard=floor |
| **EXP-153** | Application — correctly uses floor scenario for capability injection + medium scenario for comparison |
