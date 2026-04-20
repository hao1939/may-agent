# DD-785: TrajAD — Trajectory Anomaly Detection for Trustworthy LLM Agents ★★★★★

**Paper**: "TrajAD: Trajectory Anomaly Detection for Trustworthy LLM Agent Operations"
**Authors**: Haoran He, Xin Wang, Hao Guan, Fei Mi, Yitong Li, Wenwu Zhu
**arXiv**: 2602.06443 | **Submitted**: 2025-02-10
**Fills**: Post-EXP-101 gap — Behavioral (non-linguistic) failure prediction signals

---

## Core Finding

Action trajectories — the **sequence of tool calls, API invocations, and state transitions** — contain reliable anomaly signals that predict task failure, even when the agent's natural language reasoning appears coherent. TrajAD introduces a trajectory-level anomaly detection framework that operates on **action-type sequences** rather than linguistic content, achieving strong AUROC on failure prediction tasks where linguistic signals (like HVR) fail.

This is the **direct alternative** to EXP-101's failed HVR approach: instead of analyzing *what the agent says*, analyze *what the agent does*.

## Key Technical Contributions

### 1. Action Trajectory Representation
Trajectories are encoded as sequences of discrete action types (tool selections, API calls, state changes) with temporal ordering. The key insight: **anomalous trajectories exhibit distinctive patterns** — repetitive tool calls (retry loops), unusual tool-call orderings, premature termination, and action-type distribution shifts.

### 2. Multi-Granularity Detection
TrajAD operates at three levels:
- **Step-level**: Individual action anomalies (wrong tool for context)
- **Subsequence-level**: Anomalous action patterns (retry spirals, oscillation between tools)
- **Trajectory-level**: Overall trajectory shape divergence from successful reference trajectories

### 3. Unsupervised Anomaly Detection
Uses learned representations of "normal" trajectories from successful task completions, then flags deviations. No failure labels required for training — only needs examples of successful trajectories.

## Relevance to EXP-101 and Our Architecture

**This is exactly what EXP-101 should pivot toward.** EXP-101 showed HVR (linguistic hedging) has AUROC 0.535 — essentially random. TrajAD's behavioral signals operate on a fundamentally different information channel:

| Signal Type | Source | EXP-101 AUROC | TrajAD Approach |
|-------------|--------|---------------|-----------------|
| Linguistic (HVR) | Agent's self-report | 0.535 | Not used |
| Behavioral (trajectory) | Agent's actions | Not tested | Core signal |
| Structural (tool patterns) | Action sequences | Not tested | Multi-granularity |

### Connection to MASC (DD#667)
MASC does step-level anomaly detection using metacognitive signals. TrajAD complements this with **trajectory-level** patterns — where MASC catches individual step errors, TrajAD catches emergent failure modes that only appear in sequences (retry loops, oscillation, premature termination).

### Connection to DD#781 (Confidence Dichotomy)
DD#781 showed tool type affects calibration. TrajAD's action-type encoding naturally captures which tools are being called, meaning tool-type-aware calibration could be layered on top of trajectory anomaly scores.

## Implications

### For EXP-102 Design
1. **Extract action-type sequences** from Bob's session logs (tool calls, file reads/writes, bash commands)
2. **Build "normal trajectory" reference set** from successful task completions
3. **Compute trajectory deviation scores** as a candidate failure-prediction metric
4. **Compare AUROC** against HVR (0.535 baseline) — prediction: behavioral signals achieve >0.7

### For Bob's Architecture (KE-105)
- The Cognitive Companion (DD#770) could integrate TrajAD-style monitoring as a **parallel behavioral analysis channel**
- Tool-call pattern anomalies are computable in real-time with minimal overhead
- Trajectory deviation score could serve as a trigger for deeper verification (CR#324 Layer 1)

### For Metric Design
- **New metric candidate**: Trajectory Anomaly Score (TAS) — deviation of current action sequence from reference successful trajectories
- **New metric candidate**: Retry Density — frequency of repeated tool calls within a window
- **New metric candidate**: Tool Oscillation Index — frequency of back-and-forth between tool types

## Ratings

| Dimension | Score |
|-----------|-------|
| Novelty | ★★★★★ — First systematic trajectory-level anomaly detection for LLM agents |
| Rigor | ★★★★ — Multi-granularity framework with unsupervised approach |
| Relevance to us | ★★★★★ — Direct answer to EXP-101's HVR failure |
| Actionability | ★★★★★ — Clear path to EXP-102 behavioral signal extraction |

**Overall: ★★★★★**

## Cross-References
- **EXP-101**: HVR failure (AUROC 0.535) — TrajAD provides the behavioral alternative
- **DD#667**: MASC step-level anomaly detection — TrajAD adds trajectory-level patterns
- **DD#770**: Cognitive Companion — behavioral monitoring integration point
- **DD#781**: Confidence Dichotomy — tool-type metadata enhances trajectory features
- **CR#343**: Monitoring Turn — TrajAD is a concrete runtime behavioral signal system
- **CR#324**: Verification Orchestration — trajectory anomaly as verification trigger

---
*Scout DD-785 | 2026-04-26 | Post-EXP-101 Behavioral Failure Prediction — Trajectory Anomaly Detection*
