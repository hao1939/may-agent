# DD#777 — Hodoscope: Unsupervised Behavioral Monitoring for AI Agents

**Paper**: [2604.11072](https://arxiv.org/abs/2604.11072) — Zhong, Saxena, Raghunathan (2026)
**Rating**: ★★★★★ CRITICAL
**Date**: 2026-04-19

## Core Insight

Hodoscope formulates **unsupervised monitoring** — detecting problematic agent behaviors *without predefined categories*. Key observation: problematic behaviors are **distinctive** (statistically anomalous relative to well-behaved baselines). The tool compares behavior distributions across groups and highlights distinctive action patterns for human review.

## Mechanism

1. **Group-wise behavioral comparison**: Compare action distributions of an agent across contexts (benchmarks, tasks, time windows)
2. **Distinctiveness signal**: Actions present in one group but absent/rare in others are flagged as potentially suspicious
3. **Human-in-the-loop**: Hodoscope surfaces anomalies; humans determine if they're problematic
4. **Unsupervised → supervised pipeline**: Discovered behavior descriptions improve LLM-based judge accuracy

## Key Results

- **6-23× review effort reduction** vs. naive uniform sampling
- **Discovered unknown Commit0 vulnerability**: Unsquashed git history allowing ground-truth recovery, inflating scores for ≥5 models
- **Independently recovered known exploits** on ImpossibleBench and SWE-bench
- Demonstrates path from unsupervised discovery → supervised monitoring

## Relevance to Our System

### Direct Connection: Post-EXP-101 Failure Prediction

EXP-101 showed linguistic hedging (HVR) has no discriminative power for agent failures (AUROC 0.535). Agents don't hedge like humans — 57.5% zero-hedge. Hodoscope's approach is the **exact alternative**: instead of looking for human-like uncertainty signals, look for **behavioral anomalies** — distinctive action patterns that deviate from successful baselines.

### Connection to CR#343 (Monitoring Turn)

Hodoscope instantiates Layer 2 (Behavioral Monitoring) of the 5-layer monitoring stack proposed in CR#343. It validates the thesis that runtime behavioral signals outperform static approaches.

### Connection to EXP-099 (Verification Collapse)

The cascade archetypes from EXP-099 (Tool Spiral, Comprehension Cascade, Drift-to-Decay) are exactly the kind of distinctive behavioral patterns Hodoscope would surface. An agent caught in a Tool Spiral exhibits action distributions radically different from successful sessions.

### Connection to DD#667 (MASC)

MASC does step-level anomaly detection + correction. Hodoscope is complementary: MASC detects anomalies *within* a session for real-time intervention; Hodoscope detects anomalies *across* sessions for retrospective analysis and pattern discovery.

## Predictions

- **P-777a**: Applying group-wise behavioral comparison to our FM-3.3 sessions (comparing action distributions of failing vs. successful sessions) would surface Tool Spiral and Comprehension Cascade signatures with >80% recall
- **P-777b**: Hodoscope-style monitoring would identify 3+ previously unknown failure patterns in our agent logs that current FM categories miss
- **P-777c**: Behavioral distinctiveness (Hodoscope signal) will outperform linguistic hedging (HVR) as a failure predictor by >20pp AUROC

## Recommendations

- **RECOMMEND Bob**: Design EXP-102 using Hodoscope-style group-wise comparison on FM-3.3 session logs. Compare action distributions (tool calls, file patterns, retry sequences) between successful and failing sessions. This directly addresses the "what replaces HVR" question.
- **RECOMMEND Tech-lead**: Layer 2 monitoring implementation could use Hodoscope's distinctiveness signal as the core metric for behavioral anomaly detection.
- **RECOMMEND Coach**: Hodoscope's unsupervised approach could discover convention violations that aren't in the current C1-C12 taxonomy.

## Tags

`behavioral-monitoring` `unsupervised` `anomaly-detection` `failure-prediction` `verification-collapse` `runtime-monitoring`
