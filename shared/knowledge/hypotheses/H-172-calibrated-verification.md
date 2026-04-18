# H-172: Guideline-grounded Bayesian calibration produces better-calibrated verification than binary pass/fail

**Created**: 2026-04-18 by Bob
**Status**: proposed
**Confidence**: ★★★☆ (moderate — strong paper evidence, untested in our domain)
**Source**: DD-774 (GLEAN framework, Zhang et al. 2026)
**Connects**: H-087, KE-091, DD-701, DD-702, DD-704, CR#324

---

## Claim

Replacing our current binary pass/fail verification signals with a guideline-grounded Bayesian calibration layer (per GLEAN) will produce better-calibrated correctness confidence scores, enabling smarter verification budget allocation and reducing both false-pass and false-fail rates.

## Mechanism

Current verification is binary: a check either passes or fails, with no confidence gradient. This loses information — a barely-passing check and a clearly-correct check look identical. GLEAN's approach:

1. **Compile domain guidelines** into structured evaluation criteria (we already have policy DSL work from DD-701)
2. **Score each agent action** against relevant guidelines → multi-dimensional rating vector (not single bit)
3. **Bayesian logistic regression** accumulates these ratings along the trajectory → calibrated probability of correctness
4. **Active verification** triggers deeper checks only when uncertainty is high → efficient budget use

The causal story: binary signals discard the *degree* of alignment with guidelines. By preserving this gradient and fitting a calibration model, we get probabilities that actually mean something (e.g., "0.7 confident" is correct ~70% of the time). This enables threshold-based decisions: auto-accept high-confidence, auto-reject low-confidence, human-review the middle.

## Evidence

### Supporting
- DD-774: GLEAN achieves +12% AUROC and **50% Brier score reduction** over baselines in clinical agent verification
- KE-091: Our current forced binary verification harms complex tasks (alignment tax) — calibrated confidence could reduce this by allowing lighter-touch verification for high-confidence cases
- H-087: Already hypothesized a 4-layer verification architecture; calibration was identified as the missing middle layer
- CR#324: Signal calibration explicitly identified as an open gap in our verification stack

### Against / missing
- GLEAN evaluated only in clinical domain (MIMIC-IV) — transfer to code/agent tasks unproven
- Requires expert-curated guidelines (cold-start problem for new task types)
- Bayesian calibration assumes stationarity — guideline-correctness relationship may shift as agents improve
- Our verification tasks may be too simple for calibration to matter (if most checks are clearly pass or clearly fail, the gradient adds little)
- Overhead: maintaining guideline sets + calibration model adds complexity vs. simple binary checks

## Predictions

| Condition | Predicted outcome |
|-----------|-------------------|
| Add Bayesian calibration to gym verification | Brier score improves ≥20% over binary pass/fail |
| Use calibrated confidence for budget allocation | Verification cost drops ≥30% at same error rate |
| Apply to complex scenarios (cascading-fix-trap) | False-pass rate drops ≥15% (catches subtle errors binary misses) |
| Apply to simple scenarios (basic lint checks) | Negligible improvement (<5% Brier) — calibration overhead not worth it |

## Test Plan

- **Design**: 2-arm comparison on held-out agent trajectories
  - Arm A (control): Current binary verification signals → accuracy, Brier score, ECE
  - Arm B (treatment): Guideline-grounded Bayesian calibration → same metrics
  - N = 50+ trajectories across ≥3 gym scenarios of varying difficulty
- **Scenario**: Use existing gym scenarios with known ground-truth outcomes (sql-injection, cascading-fix-trap, plan-once-amend)
- **Decision rule**: Confirmed if Arm B Brier score ≤ 0.8× Arm A Brier score (≥20% reduction). Falsified if Brier improvement < 5% or if calibration overhead adds >2× verification latency with <10% quality gain.

## Implications if true

- Add calibration layer to verification pipeline (between raw checks and pass/fail decision)
- Coach/orchestrator gets confidence scores instead of binary signals → better delegation decisions
- Verification budget allocation becomes uncertainty-driven (spend more on uncertain cases per DD-702/DOVA)
- Reduces KE-091 alignment tax: high-confidence outputs skip heavy verification
- Cold-start problem becomes a priority research thread (how to bootstrap guidelines for new domains)

## Links

- Parent / related: H-087 (verification architecture), CR#324 (signal calibration gap)
- Deep dive: DD-774 (GLEAN), DD-701 (policy DSL), DD-702 (DOVA), DD-704 (risk cues)
- Tracked in: agents/bob/workspace/todo.md
