# H-094: Hedge-to-Verify Ratio as Zero-Cost Agent Confidence Gate

**Status**: WEAK SIGNAL (EXP-101 Phase 1 complete)  
**P(H)**: 0.50 (updated from 0.45 — precision target met, AUROC target missed)  
**Created**: 2026-04-09  
**Source**: SELFDOUBT paper (arXiv:2604.06389, Pandey et al., COLM 2026 submission)  
**Connected to**: H-093 (verification collapse), KE-068 (SELFDOUBT findings), DD-656 (SELFDOUBT paper), DD-679 (explicit uncertainty interfaces), DD-680 (linguistic hedging mapper), DD-681 (reasoning contamination effect)

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

## Mechanistic Insights from Literature (DD-679/680/681)

Three papers from Scout's April 2026 arXiv scan provide mechanistic explanations for EXP-101's results:

### DD-679: Explicit Uncertainty Interfaces (Guo et al., 2026)
- **Global interface** (verbalized confidence for final answers) improves calibration by surfacing what the model already "knows"
- **Local interface** (`<uncertain>` markers during reasoning) induces **late-layer reorganization** — fundamentally changes how the model processes, not just how it reports
- **Implication for H-094**: HVR is a *passive* local interface — detecting hedging the model wasn't trained to produce. DD-679 shows that *trained* local markers are far more effective. Our regex-based hedging detection is picking up noise, not signal. Explains why AUROC is barely above chance.

### DD-680: Linguistic Confidence Hedging Mapper (Tao et al., 2025)
- First large-scale hedging expression dataset with human-annotated confidence scores
- Lightweight mapper: hedge expression → calibrated confidence score (regex + lookup table)
- **Key finding: weighted hedging scores >> binary counting**
- **Implication for H-094**: EXP-101 used binary hedge/no-hedge classification. DD-680 shows this throws away the most informative signal — the *degree* of hedging. "I think" ≠ "perhaps" ≠ "I'm fairly sure". A weighted mapper applied to our data could potentially improve AUROC, though the RCE effect (DD-681) limits the ceiling.

### DD-681: Reasoning Contamination Effect (Miao & Ungar, 2026)
- **Calibration and verbalized confidence are ORTHOGONAL** in LLM representation space (3 models, 4 datasets)
- When models simultaneously reason AND verbalize confidence, reasoning activations **disrupt** the confidence direction — the **Reasoning Contamination Effect (RCE)**
- **Implication for H-094**: This is the *mechanistic* explanation for EXP-101's failure. Agent reasoning traces are exactly the condition where RCE operates maximally — every agent turn involves simultaneous reasoning. The model's internal "knowing" and external "saying" are decoupled. Passive hedging detection cannot bridge this gap. Two-stage adaptive steering (separate confidence assessment from reasoning) would be needed, which fundamentally changes the approach from zero-cost to moderate-cost.

### Synthesis: Why HVR Doesn't Transfer

The three papers converge on a unified explanation:
1. **Passive detection fails** (DD-679): Hedging markers in untrained models are noise, not signal
2. **Binary counting loses information** (DD-680): Weighted scores capture gradations that binary misses
3. **Reasoning contaminates confidence** (DD-681): The fundamental bottleneck — simultaneous reasoning disrupts whatever confidence signal exists

This suggests H-094's core approach (passive zero-cost hedging detection) has a **mechanistic ceiling** that no amount of marker tuning can overcome. The path forward, if any, would require either:
- **Trained uncertainty interfaces** (DD-679's local markers) — requires model fine-tuning, not prompting
- **Two-stage assessment** (DD-681's adaptive steering) — separate confidence from reasoning, adding cost
- **Structural proxy signals** — shift from linguistic hedging to behavioral patterns (retry counts, tool-call patterns, error recovery sequences) that aren't contaminated by RCE

P(H) stays at 0.50 — the mechanistic evidence doesn't further disconfirm (already priced into weak signal), but it does explain *why* and closes off the "better markers would fix it" path.

---
*Updated by Bob | 2026-04-09 | EXP-101 Phase 1 complete*
