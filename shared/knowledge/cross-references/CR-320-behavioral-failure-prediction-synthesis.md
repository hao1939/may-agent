# CR-320: Behavioral Failure Prediction in Agent Trajectories — Literature Synthesis

**Date**: 2026-04-09  
**Papers**: DD-682 (Trajectory Guard), DD-683 (SWE-PRM), DD-684 (AgentProcessBench), DD-668 (AgentErrorTaxonomy), + 2602.13320 (Martingale), 2604.00594 (Agent Psychometrics)  
**Context**: Sprint S12 open question #1 — high-complexity verification failures in EXP-100

## The Emerging Stack

The literature converges on a **four-layer stack** for behavioral failure prediction and correction in agent systems:

```
Layer 4: INTERVENTION    — SWE-PRM (DD-683): taxonomy-guided feedback injection
Layer 3: DETECTION       — Trajectory Guard (DD-682): real-time anomaly detection (32ms)
Layer 2: DIAGNOSIS       — AgentErrorTaxonomy (DD-668): root-cause categorization
Layer 1: EVALUATION      — AgentProcessBench (DD-684): step-level quality benchmarking
```

Each layer builds on the one below. The theoretical foundation comes from the Martingale analysis (2602.13320): error propagation is bounded at O(√T) with periodic re-grounding every ~9 steps.

## Key Cross-Paper Insights

### Insight 1: Detection → Taxonomy → Intervention Pipeline
The papers collectively describe a pipeline:
1. **Detect** anomalous trajectory patterns (Trajectory Guard: F1 0.88-0.94 in 32ms)
2. **Classify** the failure type (AgentErrorTaxonomy: 5 modules × cascade chains)
3. **Intervene** with categorical feedback (SWE-PRM: +10.6pp with taxonomy-guided feedback)
4. **Evaluate** step-level quality (AgentProcessBench: ternary labels, error propagation)

This is the first time all four components exist simultaneously in the literature.

### Insight 2: Categorical > Prescriptive Feedback
SWE-PRM shows that telling an agent "you're looping" (+10.6pp) works better than telling it "run command X." This parallels the verbalized confidence finding (CR-319): descriptive metacognitive signals outperform directive interventions.

**Principle**: The optimal intervention level is one abstraction above the failure — name the pattern, don't dictate the fix.

### Insight 3: Three Failure Detection Paradigms
| Approach | Speed | Accuracy | Training | Example |
|----------|-------|----------|----------|---------|
| **Embedding-based** (Trajectory Guard) | 32ms | F1 0.88-0.94 | Requires training data | Siamese Recurrent Autoencoder |
| **LLM Judge** | 500-800ms | Varies | Zero-shot | GPT-4 evaluator |
| **Process Reward Model** (SWE-PRM) | Medium | High for SWE | Trained on SWE-bench | PRM classifier |

For production deployment, a **tiered system** is optimal:
- Tier 1 (every step): Lightweight embedding check (Trajectory Guard-style, 32ms)
- Tier 2 (flagged steps): PRM classification with taxonomy-guided feedback
- Tier 3 (rare): Full LLM Judge for novel failure modes

### Insight 4: The Neutral-Step Problem
AgentProcessBench reveals that distinguishing neutral exploration from genuine errors is the **hardest classification challenge** for current models. This directly explains EXP-100 high-complexity failures:
- At high complexity, agents need more exploration
- Systems that treat exploration as error prematurely constrain the agent
- Systems that treat errors as exploration allow cascading failures

The **ternary classification** (Correct/Neutral/Error) is essential — binary fails at this boundary.

### Insight 5: Error Propagation is Predictable
The Martingale analysis proves cumulative distortion grows linearly with O(√T) deviations. Periodic re-grounding every ~9 steps keeps error bounded. Combined with SWE-PRM's intervention, this suggests:
- Monitor trajectory embeddings continuously (Trajectory Guard)
- Every ~9 steps, inject a re-grounding check
- If anomaly detected, inject taxonomy-guided feedback (SWE-PRM style)

This is a **mechanistically grounded re-grounding schedule** — not arbitrary, but derived from concentration bounds.

### Insight 6: Agent Psychometrics — Task Difficulty Prediction
Agent Psychometrics (2604.00594) introduces IRT-based task-level performance prediction. Key innovation: decomposing agent ability into **LLM ability + scaffold ability** components. This matters because:
- Our experiments vary scaffold (verification strategy) while holding LLM constant
- IRT decomposition could predict which tasks will fail under which scaffold configurations
- Can calibrate experiment difficulty without running full evaluations

## Synthesis: Design Recommendation for Next Sprint

### Immediate (EXP-101 or next experiment)
1. **Implement ternary step classification**: Correct / Neutral / Error for all verification traces
2. **Add trajectory anomaly detection**: Even a simple n-gram action pattern detector catches tool spirals
3. **Use taxonomy-guided feedback**: When loop/spiral detected, inject categorical message

### Medium-term
4. **Train lightweight trajectory encoder**: Following Trajectory Guard architecture, but on our domain
5. **Implement 9-step re-grounding protocol**: Based on Martingale bounds, inject re-grounding every ~9 steps
6. **Build process reward model**: Train on annotated trajectories from our experiments

### Research Direction
7. **The neutral-step frontier**: Develop methods to distinguish productive exploration from neutral drifting — this is the key unsolved problem that limits step-level process quality

## Connection to Sprint S12 Open Questions

| Open Question | Literature Answers |
|--------------|-------------------|
| Why do high-complexity tasks fail? | Error propagation compounds (Martingale); exploration/error boundary is hardest (AgentProcessBench); no real-time detection (Trajectory Guard not deployed) |
| What intervention works? | Taxonomy-guided PRM feedback (+10.6pp, SWE-PRM); re-grounding every ~9 steps (Martingale); ternary classification to permit exploration |
| How to measure improvement? | Step-level ternary labels (AgentProcessBench); trajectory anomaly F1 (Trajectory Guard); IRT decomposition (Agent Psychometrics) |
