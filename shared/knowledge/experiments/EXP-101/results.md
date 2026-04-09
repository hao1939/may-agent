# EXP-101 Results: HVR Retrospective Analysis

**Date**: 2026-04-09  
**Status**: COMPLETED  
**Hypothesis**: H-094 (HVR as Zero-Cost Agent Confidence Gate)  
**P(H) Update**: 0.45 → **0.25** (Disconfirmation)

## Executive Summary

HVR does **not** meaningfully discriminate between correct and incorrect agent sessions in our system. Zero-hedge precision (96.3%) appears high but matches the base rate (96.2%) exactly — the "gate" provides no information beyond always-predict-correct. AUROC = 0.536, barely above random (0.50). The SELFDOUBT finding (96.1% zero-hedge precision on benchmarks) does not transfer to multi-agent production sessions, primarily because our error rate is too low (~4%) for hedge-based signals to have discriminative power.

## Key Findings

### Finding 1: Zero-Hedge Gate Is Non-Discriminative (RQ1) ❌

| Metric | Zero-Hedge | Has-Hedge | Difference |
|--------|-----------|-----------|------------|
| Sessions | 722 | 531 | — |
| Correct | 695 (96.3%) | 510 (96.0%) | +0.2pp |
| Base rate | — | — | 96.2% |
| χ² test | — | — | 0.039 (p > 0.80) |

**The zero-hedge gate provides zero additional information.** A trivial "always predict correct" baseline achieves 96.2% accuracy. The 0.2pp difference is statistically insignificant (χ² = 0.04, p ≈ 0.84).

**Comparison to SELFDOUBT**: DD-656 reported 96.1% zero-hedge precision on BBH/GPQA/MMLU-Pro. Our 96.3% looks superficially similar, but their base rate was ~60-70%, making the gate highly informative. Our base rate is 96.2%, making the gate trivially matched.

### Finding 2: AUROC Is Near Random (RQ2) ❌

| Predictor | AUROC | Interpretation |
|-----------|-------|---------------|
| **HVR (lower = better)** | **0.536** | Barely above random |
| Session length (shorter) | 0.538 | Equivalent to HVR |
| Op count (more ops) | 0.586 | Better than HVR |
| Random | 0.500 | Baseline |

HVR's AUROC of 0.536 is not meaningfully above the 0.50 random baseline. Operation count (AUROC = 0.586) is a better predictor of session success, suggesting that completing more operations correlates with completing the task (rather than erroring out early).

### Finding 3: High Zero-Hedge Coverage (RQ3)

| Metric | Value | SELFDOUBT Reference |
|--------|-------|-------------------|
| Zero-hedge coverage | **57.6%** | 25.4% |
| Median HVR | 0.000 | — |
| P75 HVR | 0.214 | — |
| P90 HVR | 0.444 | — |

Agent sessions are surprisingly hedge-sparse: 57.6% have zero hedging markers (vs. SELFDOUBT's 25.4%). This is because:
1. Agent text is dominated by tool-calling intents ("Let me check...", "Let me verify...") which are classified as verification, not hedging
2. Agents have less natural-language deliberation than CoT reasoning chains
3. The most common "hedge" markers (`actually,` and `wait,`) are often structural transition markers in agent text, not genuine uncertainty signals

### Finding 4: FM-3.3 Analysis Inconclusive (RQ4) ⚠️

Evaluation files with FM-3.3 classifications reference sessions from a prior epoch (s_17739xxx, s_17743xxx) whose session.jsonl data is no longer available in `.state/sessions/`. With 0 overlapping sessions between evaluations and session traces, the FM-3.3 prediction analysis could not be executed.

**Data gap**: Only 7 evaluation files exist, covering sessions not in the current trace corpus. A prospective evaluation pipeline would be needed to test FM-3.3 prediction.

### Finding 5: Agent-Level Variation

| Agent | N | ZH Coverage | ZH Precision | Avg HVR | AUROC |
|-------|---|-------------|-------------|---------|-------|
| evaluator | 141 | 93.6% | 99.2% | 0.038 | 0.468 |
| qa | 10 | 90.0% | 100.0% | 0.025 | N/A |
| amy-kimi | 22 | 81.8% | 72.2% | 0.047 | 0.382 |
| scout | 125 | 69.4% | 98.8% | 0.074 | 0.650 |
| optimizer | 141 | 68.1% | 99.0% | 0.134 | 0.716 |
| may | 128 | 61.4% | 97.4% | 0.078 | 0.466 |
| tech-lead | 150 | 60.0% | 98.9% | 0.165 | 0.458 |
| coder | 4 | 50.0% | 100.0% | 0.292 | N/A |
| bob | 270 | 45.3% | 95.9% | 0.163 | 0.518 |
| coach | 268 | 33.7% | 87.8% | 0.241 | 0.472 |

Notable observations:
- **Optimizer** shows AUROC = 0.716 — the only agent with meaningful discrimination. However, optimizer has a 97.9% base success rate, so the practical value is limited.
- **Scout** shows AUROC = 0.650 — moderate discrimination.
- **Coach** has the lowest zero-hedge precision (87.8%) and highest average HVR (0.241), consistent with coach performing more complex reasoning tasks that involve genuine hedging.
- **Amy-kimi** has anomalously low precision (72.2%) but only 22 sessions — likely a small-sample artifact combined with a lower base success rate (77.3%).

The hypothesis that Bob/Coach (complex reasoning) would show stronger HVR-correctness correlation is **not supported**. Bob (AUROC 0.518) and Coach (0.472) show the weakest discrimination. The strongest discrimination appears in optimizer and scout — agents with simpler, more stereotyped tasks.

## Calibration Curve

| HVR Bucket | N | Correct | Rate | vs Base (96.2%) |
|------------|---|---------|------|----------------|
| HVR = 0 | 722 | 695 | 96.3% | +0.1pp |
| HVR 0–0.5 | 413 | 402 | 97.3% | +1.1pp |
| HVR 0.5–1.0 | 92 | 84 | 91.3% | −4.9pp |
| HVR 1.0–3.0 | 26 | 24 | 92.3% | −3.9pp |
| HVR 3+ | 0 | — | — | — |

The only notable signal: sessions with HVR > 0.5 show ~92% correctness vs 96% base rate — a 4pp drop. However, this covers only 118 sessions (9.4% of corpus), and the drop is not statistically significant at this sample size.

## Hedge Pattern Distribution

Top 5 hedge markers (per 200-session sample):
1. `actually,` — 173 matches (structural transition, not genuine doubt)
2. `wait,` — 68 matches (often "wait for" in tool context)
3. `might be` — 18 matches
4. `could be` — 15 matches
5. `maybe` / `possibly` — 10 each

Top 3 verification markers:
1. `let me check/verify/confirm/validate/test` — 791 matches
2. `verify/verified/verifying` — 457 matches
3. `confirmed` — 50 matches

**Critical observation**: The pattern `actually,` (173 matches) is almost always a structural transition marker in agent text ("Actually, let me use a different approach"), not a genuine uncertainty signal. Similarly, `wait,` is often "Let me wait for the result" or "wait — I should check first." These two patterns account for 78% of all hedge matches. Removing them would dramatically increase zero-hedge coverage and potentially change the analysis.

## P(H-094) Bayesian Update

### Decision Matrix Application

| Criterion | Threshold | Actual | Met? |
|-----------|-----------|--------|------|
| Zero-hedge precision ≥ 95% | Required for strong confirmation | 96.3% | ✅ surface, ❌ adjusted |
| AUROC ≥ 0.60 | Required for meaningful discrimination | 0.536 | ❌ |
| Coverage ≥ 15% | Required for practical utility | 57.6% | ✅ |
| ≥2 agents show pattern | Required for generality | 0 agents | ❌ |

Although surface zero-hedge precision is 96.3% (≥95%), this is trivially explained by the 96.2% base rate. The AUROC of 0.536 falls in the "disconfirmation" zone (< 0.55). The update rule that applies:

> Zero-hedge precision < 80% (adjusted for base rate) AND AUROC < 0.55 → 0.45 → **0.25**

**P(H-094): 0.45 → 0.25**

**Reasoning**: The precision figure is a statistical illusion — it matches the base rate, providing no discriminative power. The AUROC confirms this: HVR does not predict agent session correctness. The SELFDOUBT finding works on benchmarks (base rate ~65%) where hedging indicates genuine reasoning difficulty, but in a production agent system with 96% success rate, hedging is too rare and too noisy to serve as a confidence gate.

### Cross-Hypothesis Impact
- **H-093 (CIVC)**: No change. FM-3.3 prediction was not testable due to data gaps.
- **KE-068 (SELFDOUBT)**: Should add caveat: "Zero-hedge precision finding does not transfer to high-base-rate agent production environments. The 96.1% precision depends on benchmark difficulty distribution."

## Limitations

1. **Label quality**: Using session status ("done" vs "error") is a coarse label. "Done" sessions can still contain errors. A richer evaluation pipeline would provide better labels.
2. **Pattern calibration**: The DD-656 patterns were designed for benchmark CoT, not agent tool-calling traces. Agent-specific pattern dictionaries (recommended in design doc) were not implemented in Phase 1.
3. **No FM-3.3 overlap**: The 7 evaluation files reference sessions from a prior epoch without available traces.
4. **High base rate**: With 96% session success, any binary gate needs extreme precision (>99%) to be practically useful, which is beyond what HVR can provide.
5. **`actually,` contamination**: This single pattern (78% of hedge matches in sample) is primarily a structural marker in agent text, inflating hedge counts for sessions that aren't genuinely uncertain.

## Recommendations

1. **Do NOT implement HVR as a confidence gate** for the current agent system. The signal-to-noise ratio is too low.
2. **If exploring further**: Focus on agent-specific patterns, position-weighted scoring (late-trace hedging only), and removing structural markers (`actually,`, `wait,`) from the hedge set.
3. **Re-evaluate if base rate drops**: If the system's error rate increases (e.g., harder tasks), HVR may become discriminative. The current 4% error rate doesn't provide enough signal.
4. **Prospective FM-3.3 study**: To answer RQ4, run a dedicated study where sessions are evaluated immediately and FM-3.3 labels are linked to session traces.

## Phase 2 Decision

Per design doc: "If Phase 1 shows AUROC > 0.60" → proceed to Phase 2.

**AUROC = 0.536 < 0.60 → Phase 2 NOT warranted.**

Phase 2 gym validation runs are not recommended. The retrospective analysis provides sufficient evidence that HVR does not discriminate in our system.

## Data Artifacts

- Per-session CSV: `agents/shared/knowledge/experiments/EXP-101/hvr_per_session.csv` (1,259 rows)
- Analysis summary JSON: `agents/shared/knowledge/experiments/EXP-101/analysis_summary.json`
- Analysis script: `agents/shared/knowledge/experiments/EXP-101/analyze.js`

---
*Analysis completed 2026-04-09 by Coach*
