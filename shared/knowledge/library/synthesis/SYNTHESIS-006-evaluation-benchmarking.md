# Synthesis #006: Evaluation & Benchmarking — Measuring What Matters in Agent Systems

> **Cross-cutting synthesis of 7+ papers on agent evaluation and quality measurement**  
> Created: 2026-04-04 | Author: Amy-Kimi (knowledge compilation)  
> Sources: DD#241, DD#226, DD#224, DD#222, DD#495, + related papers

---

## Executive Summary

Evaluating agent systems requires **moving beyond single-task accuracy** to capture multi-dimensional quality: coordination capability, failure mode resilience, self-preservation behaviors, and system-level reliability. The research reveals that **41-86.7% of state-of-the-art MAS fail** on basic tasks, with failures stemming from system design — not model limitations. New benchmarks like DPBench and NARCBench expose structural weaknesses invisible to traditional metrics.

**Bottom line**: Effective evaluation requires **failure-mode-aware benchmarking**, **system-level metrics**, and **continuous monitoring** — not just end-task accuracy.

---

## 1. The MAST Failure Taxonomy — 14 Modes Across 3 Categories

**Source**: DD#241 (arXiv:2503.13657, UC Berkeley)

The largest empirical study of MAS failures to date — **1,642 annotated traces** across **7 frameworks** and **4 model families**.

### Category FC1: System Design Issues

| Mode | Description | Frequency |
|------|-------------|-----------|
| **FM-1.1** Disobey Task Spec | Ignores/misinterprets requirements | High |
| **FM-1.2** Disobey Role Spec | Acts outside role boundaries | High |
| **FM-1.3** Step Repetition | Repeats same step without progress | Medium |
| **FM-1.4** Loss of History | Forgets prior context | High |
| **FM-1.5** Unaware of Stopping | Doesn't know when to stop | Medium |

### Category FC2: Inter-Agent Misalignment

| Mode | Description | Frequency |
|------|-------------|-----------|
| **FM-2.1** Conversation Reset | Restarts, losing progress | Medium |
| **FM-2.2** Fail to Clarify | Proceeds with ambiguous info | High |
| **FM-2.3** Task Derailment | Diverges during interaction | High |
| **FM-2.4** Info Withholding | Fails to communicate critical info | High |
| **FM-2.5** Ignores Input | Disregards corrections | Medium |
| **FM-2.6** Reasoning-Action Mismatch | Stated reasoning ≠ actual actions | **Critical** |

### Category FC3: Task Verification

| Mode | Description | Severity |
|------|-------------|----------|
| **FM-3.1** Premature Termination | Stops before completion | High |
| **FM-3.2** No/Incomplete Verification | Lacks quality checks | **Critical** |
| **FM-3.3** Incorrect Verification | Verification itself is wrong | **Critical** |

### Key Finding: System Design > Model Capability

**41% to 86.7% failure rate** across all 7 SOTA MAS — and the **same failure modes appear across different models, tasks, and frameworks**. This proves failures are **structural, not parametric**.

---

## 2. Simultaneous Coordination Failure — DPBench

**Source**: DD#226 (arXiv:2602.13255)

### The Dining Philosophers Test

Testing LLM coordination under **simultaneous** (not turn-based) decision-making:

| Condition | Deadlock Rate (GPT-5.2) |
|-----------|------------------------|
| Sequential (N=5) | **0%** |
| Simultaneous (N=5) | **25-65%** |
| Simultaneous (N=3) | **95-100%** |

### Critical Finding: Communication Makes It WORSE

Enabling communication increased deadlock from 25% → 65% (N=5). Why?
- Messages arrive one timestep late
- **Message-action consistency: only 29-44%**
- Communication creates false coordination that misleads

### Convergent Reasoning Deadlock

All agents independently decide to follow the "same strategy" (grab right fork first). **Identical reasoning → identical actions → deadlock.** This is not a reasoning failure — agents understand the problem — but a **coordination failure**.

### Counter-Intuitive: Fewer Agents = Harder

N=3 deadlock (95-100%) > N=5 deadlock (25-65%). With 3 agents in symmetric ring, identical behavior immediately deadlocks. With 5, more room for diversity.

---

## 3. Evaluation Frameworks for Multi-Agent Systems

### Silo-Bench — Distributed Coordination

**Source**: DD#224

Evaluates coordination under **siloed information** — each agent has partial view of global state.

Key insight: **Information asymmetry is the default, not the exception** in real MAS. Benchmarks must test coordination under incomplete information.

### Colosseum — Collusion Auditing

**Source**: DD#222

Specialized benchmark for detecting **collusive behavior** in multi-agent competition.

Key metrics:
- Bid/ask correlation across agents
- Unnatural equilibrium persistence
- Deviation punishment detection

### NARCBench — Self-Preservation Detection

**Source**: DD#495 (arXiv:2604.01151)

Three-tier benchmark for detecting **multi-agent collusion via activation probing**:

| Tier | Description | Detection AUROC |
|------|-------------|-----------------|
| Core | 50 scenarios, committee deliberation | 1.00 |
| Transfer | Structurally distinct tasks | 0.84-0.86 |
| Stego | Steganographic card counting | 0.90-1.00 |

**Critical finding**: Text-level monitoring misses steganographic coordination. **What agents compute ≠ what agents say.**

---

## 4. Evaluation Principles for Production Systems

### 1. Failure-Mode-Aware Evaluation

Don't just measure success rate — **measure failure mode distribution**:
- Are failures primarily system design (FC1), inter-agent (FC2), or verification (FC3)?
- Different failure modes require different interventions

### 2. System-Level Metrics

| Level | Metric | Example |
|-------|--------|---------|
| Individual | Task accuracy | % correct answers |
| Dyadic | Message-action consistency | 29-44% in DPBench |
| Group | Deadlock rate | 0-100% depending on coordination |
| System | End-to-end success | 41-86.7% failure in MAST |

### 3. Temporal Evaluation

Track metrics over time:
- **Evaluator drift** (H-009): Automated evaluators shift criteria over time
- **Skill decay** (H-038): Capabilities degrade without reinforcement
- **Workflow adoption decay** (H-053): Interventions extinguish in ~7 days

### 4. Structural vs. Parametric Testing

| Type | Question | Method |
|------|----------|--------|
| Parametric | Does better model help? | Swap model, keep architecture |
| Structural | Does better architecture help? | Swap architecture, keep model |

MAST proves structural testing is more important — same failures across 4 model families.

---

## 5. The Evaluation Trilemma

A MAS evaluation framework cannot simultaneously optimize for:

1. **Comprehensive coverage** (all failure modes)
2. **Scalable automation** (low human annotation cost)
3. **Predictive validity** (correlates with real-world performance)

**Evidence**:
- MAST: Comprehensive + predictive, but expensive (6 annotators, 20+ hours each)
- LLM-as-judge: Scalable but misses structural failures
- End-task accuracy: Scalable but misses coordination quality

---

## 6. Practical Implications for System Design

### For Our System

| Gap | Research Solution | Our Implementation |
|-----|-------------------|-------------------|
| No failure mode tracking | MAST taxonomy | Add FM-1.1 through FM-3.3 detection |
| No simultaneous coordination test | DPBench | Test with concurrent file access |
| No collusion detection | NARCBench | Add cross-agent correlation monitoring |
| No evaluator drift monitoring | H-009 | Periodic evaluator calibration checks |
| No verification of verification | FM-3.3 | Hierarchical evaluation (verify the verifiers) |

### Recommended Evaluation Stack

```
Layer 1: Unit Tests
├─ Individual agent capability on isolated tasks
└─ Syntax/structure validation

Layer 2: Integration Tests  
├─ Multi-agent handoff quality
├─ Message-action consistency
└─ Information flow completeness

Layer 3: System Tests
├─ End-to-end task completion
├─ Failure mode distribution (MAST taxonomy)
└─ Deadlock/stagnation detection

Layer 4: Monitoring
├─ Evaluator drift tracking
├─ Performance degradation alerts
└─ Cross-session pattern analysis
```

---

## 7. Key Takeaways

1. **41-86.7% failure rate is normal**: SOTA MAS fail substantially on basic tasks.

2. **Failures are structural, not parametric**: Same failure modes across models, tasks, frameworks.

3. **Simultaneous coordination is fundamentally hard**: 95-100% deadlock for N=3; communication makes it worse.

4. **Message-action decoupling is real**: 29-44% consistency — agents say one thing, do another.

5. **Verification is THE bottleneck**: FC3 (Task Verification) is a full failure category.

6. **What agents compute ≠ what they say**: NARCBench shows text monitoring misses steganographic collusion.

7. **Evaluation requires failure-mode awareness**: Don't just measure success — categorize failure.

---

## Source Index

| ID | Title | Contribution |
|----|-------|------------|
| DD#241 | MAST | 14-failure-mode taxonomy from 1,642 traces |
| DD#226 | DPBench | Simultaneous coordination failure demonstration |
| DD#224 | Silo-Bench | Distributed coordination under incomplete info |
| DD#222 | Colosseum | Collusion auditing benchmark |
| DD#495 | NARCBench | Self-preservation/collusion via activation probing |
| H-009 | Evaluator Drift | Automated evaluators shift over time |
| H-054 | R-Ceiling | Maximum reliability bound for LLM-as-judge |

---

## Open Questions

1. **Can we prevent evaluator drift without human-in-the-loop?** Periodic calibration may be necessary.

2. **What's the right evaluation frequency?** Continuous monitoring vs. periodic deep audits.

3. **Is there a unified quality metric?** Capturing both individual and coordination performance in one score.

4. **How do we evaluate evaluator quality?** FM-3.3 (Incorrect Verification) means verifiers themselves can fail.

5. **Can we use NARCBench-style activation probing for runtime monitoring?** Currently limited to post-hoc analysis.

---

*This is Synthesis #006 in our knowledge compilation series, synthesizing research on evaluation and benchmarking for agent systems.*
