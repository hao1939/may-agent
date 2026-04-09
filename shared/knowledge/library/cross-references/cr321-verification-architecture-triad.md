# CR#321: The Verification Architecture Triad — Process, Workflow, and System-Level Verification Converge

**Cross-referencing:** DD#688 (Process Verification/RIS), DD#689 (Sherlock/Speculative), DD#690 (COCO/Continuous Oversight)
**Also connects to:** DD#424 (DynaTrust), DD#274 (BAVT), DD#423 (Helium), KE-096, EXP-099 (CIVC)

## Synthesis

Three independent papers, from different institutions and timeframes (Aug 2025, Nov 2025, Jan 2026), converge on the same fundamental insight: **verification must be multi-layered, budget-conscious, and decoupled from execution**.

They naturally organize into a three-tier verification architecture:

### Tier 1: Process Verification (DD#688 — RIS)
**What it checks:** Is the agent's REASONING sound, not just its answer?
- Operates at the individual step/thought level
- Key metric: Reasoning Integrity Score
- Key finding: 50-69% of correct answers are produced by broken reasoning
- Implementation: Distilled neural classifier (0.86 F1, 100× speedup)

### Tier 2: Workflow Verification (DD#689 — Sherlock)
**What it checks:** Which workflow steps actually MATTER for final output quality?
- Operates at the task/workflow graph level
- Key mechanism: Counterfactual impact analysis → selective verification
- Key innovation: Speculative execution — don't block on verification
- Results: +18.3% accuracy, -48.7% latency, -26% cost vs alternatives

### Tier 3: System Verification (DD#690 — COCO)
**What it checks:** Is the overall multi-agent system maintaining quality?
- Operates at the multi-agent system level
- Key mechanisms: Heterogeneous cross-validation, contextual rollback, bidirectional reflection
- Key innovation: Asynchronous oversight decoupled from critical path
- Results: 6.5% improvement, 95.1% of large-model perf at 30× smaller

## The Unified Verification Stack

```
┌─────────────────────────────────────────────┐
│  SYSTEM LEVEL: COCO (DD#690)                │
│  - Continuous async monitoring               │
│  - Heterogeneous cross-validation            │
│  - Contextual rollback + convergent recovery │
│  - Oscillation prevention                    │
├─────────────────────────────────────────────┤
│  WORKFLOW LEVEL: Sherlock (DD#689)           │
│  - Counterfactual impact identification      │
│  - Cost-optimal verifier assignment          │
│  - Speculative execution + rollback          │
│  - Budget-aware verification                 │
├─────────────────────────────────────────────┤
│  PROCESS LEVEL: RIS (DD#688)                │
│  - Reasoning integrity assessment            │
│  - Distilled verification classifier         │
│  - Capability-gated intervention selection   │
│  - Process ≠ outcome verification            │
├─────────────────────────────────────────────┤
│  TRUST LEVEL: DynaTrust (DD#424)            │
│  - Bayesian agent trust tracking             │
│  - Asymmetric trust updates                  │
│  - Agent isolation + replica recovery        │
│  - Weighted consensus                        │
└─────────────────────────────────────────────┘
```

## Five Convergent Principles

### 1. Verification is a Budget Problem
All three papers treat verification as a scarce resource to be allocated optimally, not applied uniformly. This aligns with BAVT (DD#274): intelligent allocation >> brute-force checking.

### 2. Decouple Verification from Execution
Sherlock: speculative execution. COCO: asynchronous monitoring. Both reject the "verify-then-proceed" synchronous model. Verification as a background safety net, not a blocking gate.

### 3. Process > Outcome
DD#688's core finding: checking WHAT an agent produces misses 50-69% of reliability problems. You must check HOW it reasons. This applies recursively up the stack — Sherlock checks process (which steps matter), COCO checks process (is the system converging).

### 4. Recovery > Prevention
All three assume errors WILL happen and focus on detection + recovery rather than prevention. Sherlock: rollback. COCO: contextual recovery. RIS: early warning. This is engineering realism.

### 5. Capability-Gated Mechanisms
DD#688: self-critique hurts small models. COCO: 30× smaller models for oversight. The verification stack should use RIGHT-SIZED models, not frontier models for everything.

## Gap: The Verification Coherence Problem

What's missing: these three tiers currently operate independently. There's no protocol for:
- **Cross-tier signaling**: If process verification (Tier 1) finds reasoning breakdown, how does this inform workflow verification (Tier 2) about which downstream nodes to prioritize?
- **Budget coordination**: Each tier has its own verification budget. How to optimize the TOTAL verification budget across tiers?
- **Coherent rollback**: If COCO (Tier 3) triggers rollback, how does Sherlock (Tier 2) know to invalidate speculative execution results from the affected sub-graph?

This is the next research frontier: **verification orchestration** — a meta-layer that coordinates verification across tiers for optimal reliability per verification dollar.

## Predictions
1. Within 12 months, production agent systems will implement at least 2 of these 3 tiers
2. The "verify everything" approach will be recognized as both impractical and insufficient (it checks answers, not reasoning)
3. Verification orchestration (the gap above) will emerge as a distinct research area by end 2026
4. The combination of process + workflow + system verification will achieve >95% error detection at <20% overhead

## Tags
`verification-architecture` `multi-tier-verification` `process-verification` `workflow-verification` `system-verification` `budget-optimization` `speculative-execution` `error-recovery`
