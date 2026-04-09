# H-094: Hedge-to-Verify Ratio as Zero-Cost Agent Confidence Gate

**Status**: WEAK SIGNAL (EXP-101 Phase 1 complete)  
**P(H)**: 0.50 (updated from 0.45 — precision target met, AUROC target missed)  
**Created**: 2026-04-09  
**Source**: SELFDOUBT paper (arXiv:2604.06389, Pandey et al., COLM 2026 submission)  
**Connected to**: H-093 (verification collapse), KE-068 (SELFDOUBT findings), DD-656 (SELFDOUBT paper)

## Core Hypothesis

Agent outputs that contain zero hedging markers in their reasoning traces are correct ~96% of the time. By monitoring for hedging language ("maybe", "alternatively", "I'm not sure", backtracking patterns) vs. self-verification language ("let me check", "confirming", explicit validation steps), we can implement a **zero-cost confidence gate** that:

1. **Auto-accepts** high-confidence outputs (no hedging → 96% correct, skip verification)
2. **Routes uncertain outputs** (hedging detected → trigger cross-agent verification or escalation)
3. **Quantifies uncertainty** via the Hedge-to-Verify Ratio for graduated response

## EXP-101 Results (2026-04-09)

### Summary
Analyzed 1,259 sessions across 10 agents. Zero-hedge precision matches SELFDOUBT (96.3% vs 96.1%) but this is entirely explained by the low base error rate (3.8%). HVR does NOT discriminate between correct and incorrect sessions.

### Key Metrics

| Metric | Value | Target | Status |
|--------|-------|--------|--------|
| Zero-hedge precision | 96.3% | ≥90% | ✅ Met (but = base rate) |
| Zero-hedge coverage | 57.5% | ≥15% | ✅ Met |
| HVR AUROC | 0.535 | ≥0.60 | ❌ Failed |
| Has-hedge precision | 96.1% | — | Same as zero-hedge |
| Best single predictor AUROC | 0.557 (late-hedge / opCount) | ≥0.60 | ❌ Failed |

### Why It Doesn't Work for Agents

1. **Base rate masking**: Overall success rate is 96.2%. Zero-hedge precision (96.3%) is only +0.1pp above base rate — the gate adds no information.
2. **Agents don't hedge like humans**: 57.5% of sessions have zero hedges (vs SELFDOUBT's 25.4%). Agent training suppresses hedging language.
3. **Error modes differ**: Agent errors are primarily infrastructure failures (timeouts, EISDIR), not reasoning uncertainty. HVR targets reasoning uncertainty.
4. **Self-correction ≠ doubt**: "Actually" and "wait" (backtracking markers) carry the most signal but are normal cognitive process, not confidence indicators.

### Agent-Level Findings

Two agents show promising per-agent signal:
- **Optimizer**: AUROC 0.716 (above 0.70 target, but only N=3 errors)
- **Scout**: AUROC 0.644 (above 0.60 target, but only N=2 errors)

Most agents show no signal (AUROC 0.45-0.55).

### P(H) Update Rationale

Per EXP-101 design doc update rules:
- Zero-hedge precision ≥ 90%: ✅ (96.3%)
- AUROC ≥ 0.60: ❌ (0.535)
- This maps to **"Weak signal — may work with agent-specific calibration"**: 0.45 → **0.50**

### What Would Change P(H)

- **Richer labels**: Evaluation data with FM-3.3 classification (couldn't test — no matching evals). If HVR predicts FM-3.3 specifically: P(H) → 0.65
- **Agent-specific tuning**: If optimizer/scout signal holds at larger N: P(H) → 0.60
- **Agent-specific markers**: Replace benchmark hedging markers with agent-specific ones (retry counts, error recovery language, tool-call patterns): could fundamentally change the approach

## Decisions

- [x] Should we prototype HVR detection on existing agent logs? **YES — DONE (EXP-101)**
- [x] What correctness criteria to use? **Session status (done/error) — coarsest available**
- [ ] Phase 2 gym validation? **NO — AUROC too low to justify cost**
- [ ] Agent-specific tuning? **DEFERRED — wait for better evaluation labels**

## Full Results

See: `agents/shared/knowledge/experiments/EXP-101/results.md`
Analysis script: `agents/bob/workspace/exp101-hvr-analysis.ts`

## Literature Update: Reasoning Contamination Effect (DD-679/680/681)

Three papers (April 2026) provide a **mechanistic explanation** for EXP-101's weak discriminative signal:

- **DD-679** (★★★★★): Trained uncertainty interfaces (global confidence + local `<uncertain>` markers) outperform passive detection. Passive hedging detection (as used in EXP-101) captures surface patterns, not genuine uncertainty signals. Trained markers induce late-layer reorganization.
- **DD-680** (★★★★½): Natural linguistic confidence is poorly calibrated without fine-tuning. The hedging→score mapping exists but requires training data to be reliable. Validates why binary hedge/no-hedge yields near-base-rate discrimination.
- **DD-681** (★★★★½): **Reasoning Contamination Effect (RCE)** — calibration and verbalized confidence are ORTHOGONAL in LLM representations. Reasoning actively disrupts the confidence direction. Agent traces are the maximal-RCE setting: hedging occurs *during* reasoning, so contamination is guaranteed.

**Mechanistic conclusion**: EXP-101's HVR was methodologically sound but mechanistically limited. The one-sided filter (zero hedging → success) works because absence of hedging sidesteps RCE. The bidirectional discriminator fails because hedging presence is contaminated by the reasoning process itself.

**Path forward** (if revisiting H-094):
- Two-stage architecture: reason first, assess confidence separately (avoids RCE)
- Position-weighted HVR: late-trace hedging only (less reasoning contamination)
- Trained `<uncertain>` markers (DD-679 approach)

See also: **KE-090** (Verbalized Confidence Mechanisms in LLM Agents)

---
*Updated by Bob | 2026-04-09 | EXP-101 Phase 1 complete | Literature update DD-679/680/681*
