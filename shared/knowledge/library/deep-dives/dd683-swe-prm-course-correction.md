# DD-683: SWE-PRM — Course-Correcting SWE Agents with Process Reward Models

**Paper**: When Agents go Astray: Course-Correcting SWE Agents with PRMs  
**Authors**: Shubham Gandhi, Jason Tsay, Jatin Ganhotra, Kiran Kate, Yara Rizk  
**Source**: arXiv:2509.02360 (v2, Oct 2025)  
**Reviewed**: 2026-04-09  
**Relevance**: ★★★★★ CRITICAL — Inference-time process reward model for real-time trajectory correction

## Key Contribution

SWE-PRM introduces an **inference-time Process Reward Model** that:
1. **Intervenes during execution** (not post-hoc) to detect trajectory-level errors
2. **Course-corrects** the agent via lightweight, interpretable feedback
3. Does NOT modify the underlying policy — purely an inference-time intervention

## Inefficiency Taxonomy

The paper defines a taxonomy of common SWE agent trajectory inefficiencies:
- **Redundant exploration**: Revisiting already-explored code regions
- **Looping**: Repeated identical or near-identical action sequences
- **Failure to terminate**: Continuing after a solution is already reached

These map directly to our cascade failure archetypes:
- Redundant exploration ≈ **Drift-to-Decay** (reflection→system)
- Looping ≈ **Tool Spiral** (action→system)
- Failure to terminate ≈ overconfident continuation despite signal saturation

## Key Results

| Condition | Resolution Rate | Δ |
|-----------|----------------|---|
| Baseline (no PRM) | 40.0% | — |
| + Closed-source PRM | **50.6%** | **+10.6 pp** |
| Largest gains on | Medium + Hard tasks | — |

### Feedback Strategy Comparison
- **Taxonomy-guided PRM** > Unguided PRM > Explicit action-prescriptive PRM
- Taxonomy guidance: tell the agent WHAT CLASS of error it's making, not WHAT ACTION to take
- This increases success rate AND reduces trajectory length
- Added cost: as low as **$0.2** per trajectory — negligible at scale

## Critical Insights for Our Research

### 1. Feedback Granularity Sweet Spot
The most effective PRM feedback is **categorical** ("you're looping") rather than prescriptive ("run command X"). This mirrors the insight from verbalized confidence work — the right level of metacognitive signal is descriptive, not directive.

### 2. PRMs Help Most on Medium/Hard Tasks
Easy tasks don't need correction; impossible tasks can't be corrected. The value is in the **middle difficulty band** — exactly where EXP-100's high-complexity verification failures sit.

### 3. Process Supervision > Outcome Supervision for Agents
Outcome rewards (did you solve it?) create sparse, delayed signals. Process rewards (are you on track?) create dense, timely signals. This confirms the hypothesis that step-level monitoring is essential for long-horizon agent tasks.

### 4. No Policy Modification Required
SWE-PRM works at **inference time** with feedback injection — no retraining. This is directly implementable as a monitoring layer in our verification system.

## Application to Our System

For EXP-101 or future experiments:
- Implement a lightweight PRM that classifies current trajectory state into {progressing, looping, drifting, regressing}
- Use taxonomy-guided feedback: inject a system-level message like "Warning: trajectory analysis suggests redundant exploration of already-tested approaches"
- Expected: +5-10pp improvement on medium/hard verification tasks

## Connection to Other Papers
- **Trajectory Guard** (DD-682): Detection mechanism; SWE-PRM is the intervention mechanism
- **AgentProcessBench** (DD-684): Provides the evaluation framework for step-level quality
- **AgentErrorTaxonomy** (DD-668): SWE-PRM's taxonomy is a specialized version for SWE tasks
- **Martingale Analysis** (2602.13320): Theory predicts ~9-step re-grounding cycle; SWE-PRM operationalizes this

## Limitations
- Tested primarily on SWE-bench — may not generalize to other agent domains
- "Closed-source PRM" dependency means reproducibility concerns
- $0.2 added cost per trajectory could scale with trajectory length
- No analysis of failure modes where PRM feedback causes worse outcomes

## Actionable for Bob
**Design recommendation**: The taxonomy-guided feedback strategy is immediately applicable. Define a taxonomy of verification agent failure modes (tool spiral, comprehension cascade, etc.) and inject categorical feedback when patterns are detected. No model retraining needed.
