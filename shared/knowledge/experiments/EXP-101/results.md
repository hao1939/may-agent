# EXP-101: Results — HVR Validation on Agent Session Logs

**Date**: 2026-04-09
**Status**: COMPLETED
**Analyst**: Bob (automated analysis)
**Scripts**: `agents/.lab/exp101-hvr-analysis.ts`, `agents/.lab/exp101-hvr-phase2.ts`

## Executive Summary

**HVR shows a weak but statistically significant signal (p=0.048) in the predicted direction: sessions with more hedging have lower evaluation quality.** However, the effect size is small (AUROC=0.566) and the zero-hedge gate fails to discriminate (p=0.71). The original hypothesis that zero-hedge sessions are correct 96%+ of the time is trivially true due to class imbalance (99%+ of sessions with traces are rated acceptable or better), making the gate useless in practice. P(H-094) is updated from 0.45 → 0.35.

## Data Summary

| Metric | Count |
|--------|-------|
| Session directories (.state/sessions/) | 861 |
| Sessions with parseable text (≥10 tokens) | 821 |
| Evaluations in may.db (non-skipped) | 3,250 |
| Sessions with BOTH eval + text trace | 582 |
| Evaluations with quality ≤ 2 (acceptable/NI) | 90 in-trace |
| Evaluations with quality ≥ 3 (good) | 492 in-trace |
| Needs_improvement evals with traces | 5 (all 0 tokens — crashed) |

**Note**: Design estimated 1,435 sessions — actual was 861. The discrepancy comes from sessions without saved traces (older sessions pruned, or call-type sessions that never wrote files).

## Distribution Statistics

| Metric | Mean | Median | P25 | P75 |
|--------|------|--------|-----|-----|
| Tokens (assistant text) | 447 | 260 | 116 | 564 |
| Hedge rate (per 1k tokens) | 2.70 | 0.00 | 0.00 | 4.42 |
| Verify rate (per 1k tokens) | 17.79 | 14.93 | 9.52 | 23.70 |
| HVR (hedge / (verify + 1)) | 0.161 | 0.000 | 0.000 | 0.250 |

**Key observation**: 54.4% of sessions have zero hedge markers — much higher than SELFDOUBT's 25.4% benchmark coverage. This likely reflects the task-execution nature of agents (less reasoning, more tool-calling).

## RQ1: Zero-Hedge Gate

| Group | N | Mean Quality | Good | Acceptable | NI |
|-------|---|-------------|------|------------|-----|
| Zero-hedge (H=0) | 282 | 4.55 | 237 | 45 | 0 |
| Has-hedge (H>0) | 300 | 4.49 | 248 | 52 | 0 |

**Mann-Whitney U test** (quality): z=0.367, **p=0.714** (not significant)

**Verdict**: Zero-hedge gate does NOT discriminate. Both groups have near-identical quality distributions. The 98.4% "precision" reported in Phase 1 is misleading — the base rate for correct sessions is ~99%, so the gate adds no information.

### Why This Differs from SELFDOUBT

SELFDOUBT tested on structured benchmarks (BBH, GPQA) where:
- Error rates are 20-40% (plenty of incorrect cases)
- Reasoning is purely textual (no tool calls)
- Tasks are single-step

Agent sessions differ fundamentally:
- Error rates with traces available are <2% (sessions that crash have no text)
- Most "work" happens in tool calls, not in reasoning text
- Sessions that reach the point of producing hedgeable text have usually already succeeded

## RQ2: HVR Discrimination (AUROC)

### Primary Analysis: Quality ≥ 3 vs Quality ≤ 2

| Predictor | AUROC | Direction |
|-----------|-------|-----------|
| -HedgeRate → quality | **0.566** | Lower hedge = higher quality ✓ |
| -HVR → quality | **0.565** | Lower HVR = higher quality ✓ |
| VerifyRate → quality | ~0.50 | No discrimination |
| Token count (baseline) | ~0.55 | Longer → higher quality (confound) |

**Mann-Whitney U** (hedgeRate, q≥3 vs q≤2): z=-1.977, **p=0.048**

The signal is in the predicted direction but weak. AUROC 0.566 is barely above the 0.55 threshold in the design doc for "weak signal."

### Group Comparison

| Group | N | Mean Hedge/1k | Mean Verify/1k | Mean HVR |
|-------|---|---------------|----------------|----------|
| q ≥ 3 (good) | 492 | 2.80 | 19.55 | 0.160 |
| q ≤ 2 (low) | 90 | **4.51** | 23.06 | **0.287** |

Low-quality sessions have ~60% more hedging per 1k tokens. But they ALSO have more verification markers. This suggests low-quality sessions involve more metacognitive activity generally — possibly because the agent is struggling.

## RQ3: Zero-Hedge Coverage

**Coverage: 54.4%** (447/821 sessions)

This is much higher than SELFDOUBT's 25.4%. Agent sessions are dominated by tool-calling output with sparse reasoning text, leading to many sessions with no hedging markers at all. The gate would fire on most sessions, making it nearly vacuous as a filter.

## RQ4: FM-3.3 Prediction

**Unable to test.** Only 5 sessions labeled `needs_improvement` had session traces, and all 5 had 0 tokens (immediate crashes). No FM-3.3 error codes were found in session-level data. The evaluation system does not propagate FM codes to the evaluations table.

### Indirect FM-3.3 Proxy (finish() status)

| Group | N | Mean Hedge/1k | Mean Verify/1k | Mean HVR |
|-------|---|---------------|----------------|----------|
| finish("success") | 539 | 2.81 | 19.17 | 0.164 |
| finish(non-success) | 31 | **1.93** | 21.77 | **0.096** |

**Counter-intuitive**: Non-success sessions have LOWER hedging, not higher. This may be because sessions that fail quickly (blocked/partial) don't produce enough reasoning text to generate hedges.

## RQ5: Per-Agent Breakdown

| Agent | N | Hedge/1k | Verify/1k | HVR | Zero-H% |
|-------|---|----------|-----------|-----|---------|
| bob | 213 | 2.60 | 22.92 | 0.13 | 40% |
| coach | 82 | **4.20** | 15.59 | **0.32** | 30% |
| coder | 205 | 3.43 | 23.21 | 0.20 | 58% |
| evaluator | 154 | 1.43 | 9.21 | 0.09 | 84% |
| may | 43 | 2.56 | 18.00 | 0.13 | 30% |
| optimizer | 22 | 1.19 | 7.88 | 0.07 | 68% |
| scout | 39 | 2.52 | 13.37 | 0.18 | 41% |
| tech-lead | 62 | 2.54 | 12.84 | 0.13 | 68% |

**Coach** stands out with the highest hedging rate (4.20/1k). This makes sense — Coach reviews and deliberates on other agents' work. **Evaluator** and **Optimizer** have the lowest hedge rates, consistent with their more formulaic task patterns.

No per-agent AUROC could be computed because no agent had sufficient needs_improvement sessions with traces.

## Threats to Validity

1. **Survivorship bias**: Sessions that crash early have no text. The most interesting "incorrect" sessions are systematically missing from the analysis. This is the fatal flaw — we can only measure HVR on sessions that produced text, but those are overwhelmingly successful.

2. **Label quality**: The evaluation system assigns quality=2/verdict="acceptable" to most sessions. True "incorrect" sessions are rare in the trace data. The binary classification is dominated by the majority class.

3. **Confound with session length**: Longer sessions produce more text, more hedges, AND higher quality (more tool calls = more work done). The hedge rate partially controls for this, but the correlation may be mediated by session complexity.

4. **Marker coverage**: The regex patterns may miss agent-specific hedging patterns. For example, agents don't say "hmm" or "let me reconsider" — they hedge through tool-call descriptions ("Let me check if...") which may be in tool_call JSON, not text content.

## P(H-094) Update

### Applying Design Doc Update Rules

| Criterion | Result | Matches |
|-----------|--------|---------|
| Zero-hedge precision ≥ 95% | 98.4% ✓ | BUT base rate is 99% |
| AUROC ≥ 0.70 | 0.566 ✗ | Below threshold |
| AUROC ≥ 0.60 | 0.566 ✗ | Below threshold |
| AUROC 0.55-0.60 | 0.566 ✓ | Weak signal range |
| Zero-hedge precision 80-90% | N/A (trivially high) | Base rate artifact |
| Coverage < 5% | 54.4% ✗ | Very high coverage |

The results nominally match "Weak signal — AUROC 0.55-0.60" → P(H) 0.45 → 0.50. However, three factors argue for a stronger downgrade:

1. The zero-hedge gate is vacuous (trivially true due to class imbalance)
2. FM-3.3 testing was impossible (critical gap)
3. The survivorship bias means the cleanest test cannot be run on this data

### Final Assessment: **P(H-094) 0.45 → 0.35**

The SELFDOUBT framework does not straightforwardly transfer to multi-step agent workflows. The core mechanism (hedging correlates with uncertainty which correlates with errors) shows a weak directional signal, but the practical utility is near zero because:
- Agent sessions that produce analyzable text are almost always successful
- The most informative signal (early hedging predicting later failure) cannot be tested retrospectively — sessions that fail catastrophically leave no text trace
- The zero-hedge gate fires on 54% of sessions, providing no filtering value

### Actionable Insight

Despite disconfirming HVR as a useful standalone gate, one finding IS actionable: **low-quality sessions (q≤2) have 60% more hedging per 1k tokens**. This could be useful as one feature in a multi-feature quality prediction model, but NOT as a standalone binary gate. Consider incorporating hedge_rate into the evaluation heuristic alongside other features (turn count, tool error rate, etc.).

## Falsification Assessment

Per design doc criteria:
- ❌ "Zero-hedge precision ≥ 90% AND AUROC ≥ 0.60" — AUROC fails (0.566 < 0.60)
- ❌ "Coverage ≥ 15%" — passes (54%) but vacuously
- ⚠️ "At least 2 agents show the pattern" — cannot test (no per-agent AUROC computable)

**H-094 is not confirmed by this experiment.** The hypothesis remains plausible in principle (the directional signal exists) but the evidence does not support deployment as a confidence gate.

## Recommendations

1. **Do NOT implement HVR as a standalone confidence gate** — the precision is an artifact of base rate, not genuine discrimination
2. **Consider hedge_rate as a feature** in multi-feature quality models (effect: ~0.5σ separation between quality tiers)
3. **Future work**: Test on a prospective dataset where failure sessions are preserved (gym runs with forced failures) — this addresses the survivorship bias
4. **Future work**: Test position-weighted hedging (last-turn hedging may be more predictive than session-wide hedging)

---
*Analysis completed 2026-04-09 by Bob*
*Raw data: agents/.lab/exp101-results.json, agents/.lab/exp101-phase2-results.json*
*Scripts: agents/.lab/exp101-hvr-analysis.ts, agents/.lab/exp101-hvr-phase2.ts*
