# EXP-101: HVR Retrospective Analysis — RESULTS

**Date**: 2026-04-09
**Status**: COMPLETE (Phase 1 only)
**Hypothesis**: H-094 (P(H)=0.45 → **0.50**)
**Outcome**: WEAK SIGNAL — Zero-hedge precision matches SELFDOUBT, but HVR fails to discriminate error sessions

## Executive Summary

Phase 1 analyzed **1,259 sessions** (of 1,446 total; 187 had no assistant text) across 10 agents. The zero-hedge gate achieves **96.3% precision** at **57.5% coverage** — remarkably close to SELFDOUBT's 96.1% precision on benchmarks. However, HVR's AUROC for predicting session failure is only **0.535**, barely above random (0.50). The core problem: agents hedge at nearly identical rates whether sessions succeed or fail. The precision result is high simply because base error rate is low (3.8%), not because hedging is a meaningful discriminator.

**P(H-094) update: 0.45 → 0.50** (weak signal — precision target met, AUROC target missed)

## Data

| Metric | Value |
|--------|-------|
| Sessions analyzed | 1,259 |
| Sessions excluded (no text) | 187 |
| Error sessions (status = error/interrupted) | 48 (3.8%) |
| Correct sessions (status = done) | 1,211 (96.2%) |
| Sessions with evaluation data | 0 (matched by sessionId) |
| Evaluation JSON files loaded | 7 (no sessionId overlap with active sessions) |

### Data Limitation
The evaluation JSON files didn't match active session IDs — they reference older/archived sessions. This means:
- **RQ4 (FM-3.3 prediction) could not be tested** — no FM error labels available
- All analysis uses session status (done vs error/interrupted) as ground truth
- This is the "coarsest" label source: "done" doesn't mean correct, "error" is reliably incorrect

## RQ1: Zero-Hedge Gate Precision

| Metric | Value | Target | Status |
|--------|-------|--------|--------|
| Zero-hedge precision | **96.3%** (697/724) | ≥90% | ✅ Met |
| Zero-hedge coverage | **57.5%** (724/1259) | ≥15% | ✅ Met |
| Has-hedge precision | 96.1% (514/535) | — | — |
| **Precision difference** | **+0.2pp** | — | ⚠️ Negligible |

### Interpretation
The zero-hedge gate "works" in the sense that 96.3% of zero-hedge sessions succeed. But **has-hedge sessions succeed at 96.1%** — almost identical. The gate adds nearly zero discriminative value. The high precision is simply reflecting the low base error rate (3.8%).

### Hedge-bucket analysis:
| Hedge Count | N | Error Rate |
|-------------|---|------------|
| 0 hedges | 724 | 3.7% |
| 1–5 hedges | 451 | 3.1% |
| 6–20 hedges | 66 | 4.5% |
| >20 hedges | 18 | 11.1% |

Only at >20 hedges does error rate meaningfully diverge from baseline. The HVR ≥ 2.0 bucket (N=1) was 100% error, but N=1 is meaningless.

## RQ2: HVR Discrimination (AUROC)

| Predictor | AUROC | vs Random |
|-----------|-------|-----------|
| HVR (hedge/verify+1) | **0.535** | +0.035 |
| Hedge rate (/1000 tokens) | 0.525 | +0.025 |
| Late-trace hedge rate | 0.557 | +0.057 |
| opCount | 0.557 | +0.057 |
| Session length (tokens) | 0.462 | −0.038 |
| HVR (excl "I think") | 0.535 | +0.035 |
| HVR (strict: excl actually/wait/I think) | 0.511 | +0.011 |

### Interpretation
- **HVR AUROC = 0.535**: Below the 0.60 target. Barely better than coin flip.
- **opCount ties with late-hedge rate** as best predictor (0.557), but neither is useful.
- **Session length AUROC = 0.462**: Shorter sessions are slightly MORE likely to error (probably initialization failures that die early).
- **"Actually" and "wait" are backtracking**, not uncertainty: removing them drops AUROC to 0.511 — they were the most discriminative hedging signals.
- **No predictor achieves the 0.60 AUROC target.**

### HVR Calibration Curve

| HVR Bucket | N | Error Rate |
|-----------|---|------------|
| HVR = 0 | 724 | 3.7% |
| 0.01–0.5 | 449 | 3.1% |
| 0.5–1.0 | 76 | 6.6% |
| 1.0–2.0 | 9 | 11.1% |
| 2.0–3.0 | 1 | 100.0% |
| >3.0 | 0 | — |

The trend direction is correct (higher HVR → higher error rate), but:
- N at high HVR is tiny (10 sessions above HVR 1.0)
- The vast majority (93%) of sessions have HVR < 0.5

## RQ3: Coverage Analysis

| Scope | Zero-Hedge Coverage |
|-------|-------------------|
| All sessions | 57.5% |
| SELFDOUBT baseline | 25.4% |

Coverage is 2.3× higher than SELFDOUBT benchmarks. This suggests agents are less "hedgy" than humans doing benchmark reasoning — likely because agents follow direct instructions and don't second-guess.

## RQ4: FM-3.3 Prediction

**COULD NOT BE TESTED** — Evaluation data with FM error codes didn't match any of the 1,259 active sessions. The 7 evaluation files reference older/archived sessions whose traces were moved to history/.

## Agent-Level Analysis (RQ5)

| Agent | N | Error% | Avg HVR | Zero-Cov% | Zero-Prec% | AUROC |
|-------|---|--------|---------|-----------|------------|-------|
| amy-kimi | 22 | 22.7% | 0.05 | 81.8% | 72.2% | 0.382 |
| bob | 270 | 4.1% | 0.16 | 45.6% | 95.9% | 0.520 |
| coach | 268 | 7.5% | 0.24 | 33.6% | 87.8% | 0.472 |
| coder | 4 | 25.0% | 0.29 | 50.0% | 100.0% | 0.667 |
| evaluator | 141 | 0.7% | 0.04 | 93.6% | 99.2% | 0.468 |
| may | 128 | 2.3% | 0.08 | 60.9% | 97.4% | 0.463 |
| optimizer | 141 | 2.1% | 0.13 | 68.1% | 99.0% | 0.716 |
| qa | 10 | 0.0% | 0.03 | 90.0% | 100.0% | — |
| scout | 125 | 1.6% | 0.07 | 68.8% | 98.8% | 0.644 |
| tech-lead | 150 | 1.3% | 0.16 | 60.0% | 98.9% | 0.458 |

### Key Findings:
- **amy-kimi has highest error rate (22.7%)** but worst AUROC (0.382) — HVR is inverted for this agent
- **optimizer shows strongest signal**: AUROC 0.716 (above 0.70 threshold), but needs cautious interpretation (only 3 error sessions)
- **scout shows moderate signal**: AUROC 0.644 (above 0.60)
- **Coach hedges most** (avg HVR 0.24) but AUROC 0.472 — hedging doesn't predict coach failures
- **evaluator rarely hedges** (93.6% zero-hedge) and rarely fails (0.7% error) — ceiling effect

### Design Doc Prediction Check:
> "Hypothesis: Bob/Coach (complex reasoning) show stronger signal than Scout/QA (simpler tasks)"

**REJECTED**: Scout (AUROC 0.644) actually shows stronger signal than Bob (0.520) or Coach (0.472). The prediction was wrong — simpler, more focused tasks may produce cleaner hedging signals.

## Marker Analysis

### Most Common Hedging Markers
| Marker | Count | Sessions |
|--------|-------|----------|
| actually | 1,230 | — |
| wait | 485 | — |
| might_be | 113 | — |
| could_be | 113 | — |
| hmm | 91 | — |
| maybe | 59 | — |
| reconsider | 44 | — |

### Key Observation
"Actually" and "wait" dominate hedging counts — these are **self-correction signals**, not uncertainty markers. When removed, AUROC drops to 0.511. This suggests:
- **Self-correction (backtracking) is the only weakly predictive hedging signal**
- Pure uncertainty markers (maybe, perhaps, not sure) are too rare to discriminate
- The SELFDOUBT paper's markers may not transfer well to agentic contexts

### Most Common Verification Markers
| Marker | Count |
|--------|-------|
| let_me_check | 5,162 |
| verify | 2,203 |
| confirmed | 331 |
| checking | 295 |

Verification language is ~10× more common than hedging language in agent traces. Agents are trained to verify, not to doubt.

## Statistical Notes

### Distribution Properties
| Metric | Min | P25 | Median | P75 | P95 | Max | Mean |
|--------|-----|-----|--------|-----|-----|-----|------|
| HVR | 0.000 | 0.000 | 0.000 | 0.214 | 0.625 | 2.800 | 0.143 |
| Hedge count | 0 | 0 | 0 | 2 | 7 | 98 | — |
| Verify count | 0 | 2 | 5 | 8 | 19 | 114 | — |

**Median HVR is 0**: Most sessions have zero hedging. The distribution is extremely right-skewed with almost all mass at 0.

### Why AUROC is Low Despite High Precision
The zero-hedge precision of 96.3% seems to validate H-094, but:
1. **Base rate effect**: Overall success rate is 96.2%. Zero-hedge precision is only +0.1pp above base rate.
2. **Discrimination requires differential**: To be useful, zero-hedge sessions must succeed *more often* than hedging sessions. The +0.2pp difference is within noise.
3. **AUROC captures this**: It measures *ranking* ability — do errors systematically have higher HVR? Answer: barely.

## Sensitivity Analysis

| Configuration | Zero-Hedge Coverage | Zero-Hedge Precision | AUROC |
|---------------|--------------------|--------------------|-------|
| Full marker set | 57.5% | 96.3% | 0.535 |
| Exclude "I think" | 57.5% | 96.3% | 0.535 |
| Exclude backtracking (actually, wait, I think) | 80.8% | 96.3% | 0.511 |

- "I think" only appears 16 times across 1,259 sessions — irrelevant (agents don't use it)
- Removing backtracking signals reduces discrimination, confirming they carry the most signal
- Precision stays at 96.3% across all configurations (= base rate, not marker-driven)

## Conclusions

### H-094 Assessment: WEAK SIGNAL
1. ✅ Zero-hedge precision meets the ≥90% target (96.3%)
2. ✅ Coverage exceeds the ≥15% target (57.5%)  
3. ❌ AUROC fails the ≥0.60 target (0.535 — barely above random)
4. ⚠️ The precision result is spurious — it reflects base rate, not discriminative power

### Why HVR Doesn't Work for Agents (as designed)
1. **Agents don't hedge like humans**: Agent training strongly discourages hedging. 57.5% of sessions have zero hedges vs SELFDOUBT's 25.4%.
2. **Self-correction ≠ uncertainty**: The most common "hedging" markers (actually, wait) are backtracking signals — normal cognitive process, not confidence indicators.
3. **Error modes differ**: Agent errors are infrastructure failures (timeouts, EISDIR), not reasoning failures. HVR was designed for reasoning uncertainty.
4. **Coarse labels**: session status (done/error) doesn't capture reasoning quality. Many "done" sessions may have subtle errors that HVR could detect.

### What Would Help
1. **Richer labels**: FM-3.3 evaluation data (verification failures) would test the hypothesis H-094 was actually designed for. Session status is too coarse.
2. **Agent-specific tuning**: Optimizer (AUROC 0.716) and Scout (0.644) show promise. Agent-specific thresholds might work.
3. **Different marker set**: Agent-specific hedging markers (e.g., "Let me try a different approach", "This didn't work", error-recovery language) may be more predictive than benchmark-derived markers.
4. **Structured markers**: Instead of text analysis, use tool call patterns (retry count, error handling) as "hedging" proxies.

### Phase 2 Decision
**DO NOT proceed to Phase 2** (gym validation). The AUROC is too low to justify spending $2-3 on gym runs. The fundamental issue is not sample size — it's that the hedging markers don't discriminate in agent traces.

## P(H) Update

**H-094: 0.45 → 0.50** (weak signal)
- Precision target met but explained by base rate
- AUROC target not met
- Two agents show promising per-agent signal — worth investigating with better labels

### Cross-Hypothesis Impact
- **H-093 (CIVC)**: No update. FM-3.3 connection could not be tested.
- **KE-068 (SELFDOUBT applicability)**: Add caveat: "Zero-hedge precision replicates at 96.3% on agent data, but discrimination is negligible due to low hedging rates and coarse labels."

## Artifacts

- **Analysis script**: `agents/bob/workspace/exp101-hvr-analysis.ts`
- **Raw output**: Included inline in this document
- **Data**: 1,259 sessions in `.state/sessions/*/session.jsonl`

---
*Analyzed by Bob | 2026-04-09 | ~$0 cost (retrospective)*
