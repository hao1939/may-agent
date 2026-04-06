# SCRAT: Stochastic Control with Retrieval and Auditable Trajectories

**Source:** arXiv:2604.03201 (April 3, 2026)  
**Authors:** Maximiliano Armesto, Christophe Kolb  
**Link:** [arXiv](https://arxiv.org/abs/2604.03201)

## Core Argument

Agentic AI is increasingly judged not by fluent output alone but by whether it can **act, remember, and verify** under:
- Partial observability
- Delayed feedback
- Strategic observation

## The Squirrel Analogy

The paper draws inspiration from squirrel behavior (arboreal locomotion, scatter-hoarding, audience-sensitive caching) to propose three coupled capabilities:

| Squirrel Behavior | AI Analog | Challenge Addressed |
|-------------------|-----------|---------------------|
| Arboreal locomotion | Fast local control | Hidden dynamics shifts |
| Scatter-hoarding | Structured episodic memory | Cue conflict & load |
| Audience-sensitive caching | Observer-belief state | Verifiability under observation |

## Three Hypotheses

**H1: Fast Local Feedback + Predictive Compensation**
Improves robustness under hidden dynamics shifts

**H2: Memory Organized for Future Control**
Improves delayed retrieval under cue conflict and load

**H3: Verifiers and Observer Models Inside Action Loop**
Enables strategic verification under partial observability

## Minimal Hierarchical Model

```
┌─────────────────────────────────────────────────────┐
│                 SCRAT Architecture                  │
├─────────────────────────────────────────────────────┤
│  Latent Dynamics          (hidden state estimation) │
│  Structured Episodic Memory (scatter-hoard pattern) │
│  Observer-Belief State    (strategic self-awareness)│
│  Option-Level Actions     (hierarchical control)    │
│  Delayed Verifier Signals (auditable trajectories)  │
└─────────────────────────────────────────────────────┘
```

## Key Distinction

Current research often studies these demands **separately**:
- Robotics → control
- Retrieval systems → memory
- Alignment work → verification

SCRAT argues these must be **coupled** in a unified framework.

## Implications for Our System

**For Memory Architecture:**
- "Memory organized for future control" aligns with ProMem's active extraction (Thread #1)
- Scatter-hoard pattern suggests distributed, cue-triggered retrieval

**For Agent Design:**
- Fast local feedback + predictive compensation mirrors OpenViking's L0/L1/L2 layers
- Observer-belief state needed for self-monitoring agents

**For Verification:**
- "Auditable trajectories" suggests explicit logging for post-hoc verification
- Delayed verifier signals imply async quality checks

## Cross-Reference

- Thread #1: Agent Memory Architecture Debate - SCRAT provides unified framework coupling memory, control, and verification
- ProMem (arXiv:2601.04463): Active memory extraction aligns with H2
- OpenViking L0/L1/L2: Fast local feedback aligns with H1
