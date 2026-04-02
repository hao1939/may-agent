# Synthesis: Evaluation Granularity & Simpson's Paradox (P181/P182)

**Date:** 2026-03-15
**Source:** Scout Cross-Ref #82 (Simpson's Paradox in MAS)
**related_to:** GUS Remediation, L3 Metrics

## 1. The Mechanism: Simpson's Paradox in Agents
Scout's analysis of 8 portfolio sources (Rare Disease, Kim et al., MADQA) proves that **Aggregate Metrics are Liars**. A Multi-Agent System (MAS) can show a +5% aggregate improvement while **degrading** performance on 40% of sub-tasks.

**The Mechanism**: Attractor Disruption.
- When a single agent is "stuck" in a wrong answer (Bad Attractor), multi-agent debate/collaboration disrupts it → **Benefit**.
- When a single agent is "correct" (Good Attractor), multi-agent noise/debate disrupts it → **Harm**.

Because "Hard" tasks and "Easy" tasks are mixed in aggregates, the "Net Benefit" is just the sum of (Big Gain on Hard) + (Small Loss on Easy). This masks the toxicity on Easy tasks.

## 2. The Principles

### P181 Evaluation Granularity
**"Aggregate metrics conceal local failures."**
Never evaluate a system solely on a global average. You must report performance distributions across at least one finer granularity (Task Type, Category, Complexity). A system that improves the mean but degrades the median is a failure.
*Source: Cross-Ref #82, Simpson's Paradox*

### P182 Hybrid Topology (Dynamic Routing)
**"Don't use a General Major for a Corporal's job."** (Extension of P169).
Since MAS hurts performance on "Easy" tasks (high single-agent baseline), the optimal architecture is **Hybrid**:
- **Low Confidence / High Complexity** → Route to MAS (Debate/Committee).
- **High Confidence / Low Complexity** → Route to Single Agent (Zero-Shot).
*Source: Cross-Ref #82, Prediction 85*

## 3. Implications for Our System
1.  **Evaluator Rubrics**: Current rubrics are scalar (0-100). They need to be categorical (Category A: 90, Category B: 20).
2.  **Ops Gates**: A "Pass Rate" of 80% is insufficient if the 20% failures are all clustered in "Safety" or "Filesystem" categories.
3.  **Routing**: We need a "Complexity Classifier" to decide when to invoke full agentic loops vs. simple tool calls.

## 4. Recommendations
1.  **Adopt P181 & P182** into `philosophy.md`.
2.  **Brief Evaluator**: Update `monitor-session` to categorize failures (e.g., "Safety", "Logic", "Syntax") and report per-category drift.
3.  **Brief Tech-Lead**: Investigate a "Complexity Router" (simple heuristic or classifier) to bypass heavy agent loops for trivial tasks (P182).
