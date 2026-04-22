# DD#855 — Decision Boundary Interventions in LLM Agents

**Pre-commitment gates, last-mile verification, and intervention points for preventing error cascades**

**Date:** 2026-04-22
**Triggered by:** EXP-099 finding — "verification gravity well" at FM-3.3 capturing 20.3% of errors
**Tags:** `decision-boundaries` `pre-commitment` `error-cascade` `verification` `tool-use` `EXP-099` `gravity-well`

---

## Motivation

EXP-099 revealed that FM-3.3 (finish/verify) acts as a **terminal attractor** — a verification gravity well where 20.3% of all errors concentrate. This suggests the final verification step doesn't catch errors but instead *absorbs and masks* them, allowing upstream cascades to propagate unchecked until the last mile. The question: where should intervention points be placed to **interrupt error cascades before they reach the terminal attractor**?

This deep dive surveys external literature on three themes:
1. **Pre-commitment mechanisms** — interrupting agent action before execution
2. **Decision boundary sharpening** — improving act/don't-act discrimination in tool use
3. **Checkpoint/gate patterns** — preventing cascade errors in multi-step workflows

---

## Theme 1: Pre-Commitment Mechanisms

### SafeHarness — Lifecycle-Integrated Security Architecture
**[arXiv:2604.13630](https://arxiv.org/abs/2604.13630)** — Lin et al. (Apr 2026)

Four defense layers woven into the agent lifecycle:
1. **Adversarial context filtering** at input processing (pre-commitment gate)
2. **Tiered causal verification** at decision making
3. **Privilege-separated tool control** at action execution
4. **Safe rollback with adaptive degradation** at state update

Cross-layer mechanisms escalate verification rigor when sustained anomalies are detected. Achieves 38% reduction in unsafe behavior rate, 42% in attack success rate.

**EXP-099 relevance:** SafeHarness's "tiered causal verification" is exactly the kind of pre-commitment gate missing before FM-3.3. Their key insight: verification rigor should *escalate dynamically* based on anomaly signals, not be a fixed terminal checkpoint. This directly addresses the gravity well — if upstream steps had increasing verification pressure, fewer errors would reach the terminal attractor.

### SEVerA — Self-Evolving Verified Agents
**[arXiv:2603.25111](https://arxiv.org/abs/2603.25111)** — Banerjee, Xu & Singh (Mar 2026)

Introduces **Formally Guarded Generative Models (FGGM)**: each generative model call has a formal output contract specified in first-order logic. A rejection sampler with verified fallback wraps every call, ensuring the contract holds for *any* input. Three-stage framework: Search → Verification → Learning.

**EXP-099 relevance:** FGGM represents the strongest possible pre-commitment gate — a formal contract that must be satisfied before output is accepted. Zero constraint violations across all experiments. The principle: **pre-commitment gates should be formal, not heuristic**. Applied to our system, this suggests each tool invocation could carry a lightweight post-condition contract rather than deferring all verification to FM-3.3.

### The Verifier Tax
**[arXiv:2603.19328](https://arxiv.org/abs/2603.19328)** — Sah et al. (Mar 2026)

Critical finding: runtime enforcement against unsafe actions **imposes a "verifier tax"** — increased conversation length and compute cost — without guaranteeing safe completion. Key metrics:
- Safety mediation intercepts up to 94% of non-compliant actions
- But safe success rate (SSR) remains **below 5%** in most settings
- Recovery rates after blocked actions: **21% best case, ~0% in complex scenarios**

**EXP-099 relevance:** ⚠️ **This is the most important paper for understanding our gravity well.** The verifier tax explains *why* FM-3.3 absorbs errors: late-stage verification blocks actions but the agent **cannot recover** from the block. The error doesn't get fixed — it gets *trapped*. Recovery rate near zero in complex scenarios matches our 20.3% error concentration. **Implication: moving verification earlier isn't enough if the agent can't reason about recovery post-intervention.**

---

## Theme 2: Decision Boundary Sharpening in Tool Use

### AgentProcessBench — Step-Level Process Quality
**[arXiv:2603.14465](https://arxiv.org/abs/2603.14465)** — Fan, Ye et al. (Mar 2026)

First benchmark for step-level verification in tool-augmented trajectories. 1,000 trajectories, 8,509 human-labeled step annotations. Key insights:
1. Weaker models show **inflated correct-step ratios** due to early termination (they quit before making errors — survivorship bias)
2. **Distinguishing neutral vs. erroneous actions** is the hardest classification problem for current models
3. Process-derived signals complement outcome supervision for test-time scaling

Uses a **ternary labeling scheme** (correct / neutral-exploratory / erroneous) with an **error propagation rule** to reduce ambiguity.

**EXP-099 relevance:** The neutral-vs-erroneous discrimination problem maps directly to decision boundary sharpening. If our system can't distinguish "exploratory but safe" from "erroneous," the verification step (FM-3.3) gets flooded with both, creating the gravity well. The ternary scheme could inform our own step classification.

### AgentSPEX — Specification and Execution Language
**[arXiv:2604.13346](https://arxiv.org/abs/2604.13346)** — Wang et al. (Apr 2026)

A workflow specification language with explicit control flow: typed steps, branching/loops, parallel execution, reusable submodules, and **explicit state management**. The harness provides checkpointing, verification, and logging.

**EXP-099 relevance:** AgentSPEX makes decision boundaries *explicit and structural* rather than implicit in the LLM's reasoning. Each typed step is a potential gate. This is the architectural pattern we'd want: verification not as a monolithic terminal step but as a **property of each step type**.

### Uncertainty as Active Control Signal
**[arXiv:2601.15690](https://arxiv.org/abs/2601.15690)** — Zhang et al. (Jan 2026, ACL 2026)

Survey showing uncertainty evolving from passive metric to active signal:
- In **reasoning**: triggers self-correction and computation allocation
- In **agents**: governs metacognitive decisions about tool use and information seeking
- In **RL**: mitigates reward hacking via intrinsic rewards

**EXP-099 relevance:** Uncertainty thresholds could serve as **dynamic pre-commitment gates**. When model uncertainty exceeds threshold before a tool call, force a verification step rather than proceeding. This would distribute verification load across the pipeline instead of concentrating it at FM-3.3.

---

## Theme 3: Checkpoint/Gate Patterns for Cascade Prevention

### AgentDebug — Where LLM Agents Fail
**[arXiv:2509.25370](https://arxiv.org/abs/2509.25370)** — Zhu et al. (Sep 2025)

Introduces **AgentErrorTaxonomy**: modular classification across memory, reflection, planning, action, and system-level operations. Key contribution: **isolating root-cause failures** from propagated effects. AgentDebug provides corrective feedback enabling iterative recovery:
- 24% higher all-correct accuracy vs. strongest baseline
- 17% higher step accuracy
- Up to 26% relative improvement in task success via targeted feedback

**EXP-099 relevance:** The root-cause isolation principle is exactly what's needed upstream of FM-3.3. If we can distinguish root causes from propagated errors *at each step*, we avoid the cascade that concentrates errors at the terminal verifier. The taxonomy (memory / reflection / planning / action / system) could map to our failure modes.

### ABBEL — Belief Bottlenecks
**[arXiv:2512.20111](https://arxiv.org/abs/2512.20111)** — Lidayan et al. (Dec 2025)

Agents maintain a **belief state** (natural language summary of task-relevant unknowns) that acts as an information bottleneck. At each step: update prior belief with observation → form posterior → act only on posterior.

Explicitly acknowledges **error propagation** as the core risk: bottleneck approaches compress information, and belief-update errors cascade. Solution: RL training to improve belief quality, with belief grading rewards.

**EXP-099 relevance:** The belief bottleneck is a **structural checkpoint** — it forces the agent to articulate what it knows before acting. Belief quality could be verified at each step (lightweight gate) rather than deferring all verification to the end. The compression-vs-accuracy tradeoff parallels our verification-concentration problem.

### Table-Critic — Collaborative Criticism and Refinement
**[arXiv:2502.10178](https://arxiv.org/abs/2502.10178)** — Yu et al. (Feb 2025, ACL 2025)

Four specialized agents for cascade prevention:
1. **Judge** — error identification
2. **Critic** — comprehensive critiques
3. **Refiner** — process improvement
4. **Curator** — pattern distillation into a self-evolving template tree

The template tree systematically accumulates critique knowledge through experience-driven learning.

**EXP-099 relevance:** The Judge/Critic separation is key: error *detection* and error *diagnosis* are separate capabilities. FM-3.3 may be conflating both, causing the gravity well. Separating "is this wrong?" from "what specifically is wrong and how to fix it?" could improve recovery rates (addressing the Verifier Tax problem).

### Resilient Write — Durable Write Surface
**[arXiv:2604.10842](https://arxiv.org/abs/2604.10842)** — Agyemang et al. (Apr 2026)

Six-layer architecture for preventing write failures in coding agents:
1. Pre-flight risk scoring
2. Transactional atomic writes
3. Resume-safe chunking
4. Structured typed errors
5. Out-of-band scratchpad storage
6. Task-continuity handoff envelopes

13x improvement in agent self-correction rate.

**EXP-099 relevance:** The **pre-flight risk scoring** layer is a concrete pre-commitment gate pattern. The 13x self-correction improvement suggests that giving the agent structured error signals (layer 4) dramatically improves recovery — directly relevant to the Verifier Tax finding that agents can't recover from blocked actions.

### Workflow Optimization Survey — Static to Dynamic Runtime Graphs
**[arXiv:2603.22386](https://arxiv.org/abs/2603.22386)** — Yue et al. (Mar 2026)

Comprehensive survey treating agent workflows as **agentic computation graphs (ACGs)**. Key distinction:
- **Static methods**: fix workflow scaffold before deployment
- **Dynamic methods**: revise workflow per-run or during execution

Proposes structure-aware evaluation: graph-level properties, execution cost, robustness, structural variation across inputs.

**EXP-099 relevance:** Our current pipeline is essentially static — FM-3.3 is always the terminal verifier. Dynamic methods could conditionally insert verification gates based on runtime signals (error likelihood, uncertainty, task complexity), preventing the fixed-gate gravity well problem.

---

## Synthesis: Implications for EXP-099 and the Verification Gravity Well

### Why FM-3.3 Becomes a Gravity Well

The literature converges on a clear explanation:

1. **Terminal verification is a trap.** The Verifier Tax (2603.19328) shows that late-stage verification blocks errors but agents cannot recover. Errors get *trapped*, not *fixed*.
2. **Binary verification is too coarse.** AgentProcessBench (2603.14465) shows the neutral-vs-erroneous distinction is where models fail. FM-3.3 likely conflates exploratory actions with errors.
3. **Monolithic verification concentrates load.** Without distributed gates, all error-detection burden falls on one step, making it a statistical attractor.

### Recommended Intervention Architecture

Based on the literature, a **distributed gate architecture** should replace the terminal verification monolith:

```
┌─────────────┐     ┌─────────────┐     ┌─────────────┐     ┌──────────────┐
│  Step N      │────▶│ Micro-Gate   │────▶│  Step N+1    │────▶│  Micro-Gate   │──▶ ...
│  (action)    │     │  (contract)  │     │  (action)    │     │  (contract)   │
└─────────────┘     └──────┬──────┘     └─────────────┘     └──────┬───────┘
                           │                                        │
                    pass/fail + why                          pass/fail + why
                           │                                        │
                    ┌──────▼──────┐                          ┌──────▼───────┐
                    │ Recovery    │                          │ Recovery     │
                    │ reasoning   │                          │ reasoning    │
                    └─────────────┘                          └──────────────┘
```

**Five design principles from the literature:**

| # | Principle | Source | Application |
|---|-----------|--------|-------------|
| 1 | **Distribute verification** — don't concentrate at terminal step | SafeHarness, AgentSPEX | Insert lightweight gates after each tool call |
| 2 | **Formal post-conditions > heuristic checks** | SEVerA (FGGM) | Each tool call carries a verifiable contract |
| 3 | **Recovery reasoning is mandatory** — blocking without recovery creates trapped errors | Verifier Tax | Gates must include recovery path, not just pass/fail |
| 4 | **Uncertainty-triggered escalation** — not every step needs the same verification rigor | UQ survey, SafeHarness | Dynamic gate depth based on confidence signals |
| 5 | **Separate detection from diagnosis** — error identification ≠ error explanation | Table-Critic | Judge and Critic as distinct capabilities |

### Concrete Next Steps for Our System

1. **Instrument error provenance at each step** — use AgentDebug-style root-cause isolation to determine which errors are *born* at FM-3.3 vs. *propagated to* FM-3.3
2. **Prototype micro-gates** — lightweight post-condition checks after tool calls (SEVerA-inspired), measuring whether they reduce FM-3.3 error concentration
3. **Add uncertainty-based gate triggering** — compute confidence proxy before each action; escalate verification when uncertain
4. **Separate Judge/Critic in FM-3.3** — if FM-3.3 must remain, at least decompose it into detection + diagnosis + recovery sub-steps
5. **Measure recovery rate** — the Verifier Tax finding suggests our system likely has near-zero recovery rate after verification failures; this is the key metric to improve

---

## Full Reference Index

| Paper | arXiv | Date | Primary Relevance |
|-------|-------|------|-------------------|
| SafeHarness | [2604.13630](https://arxiv.org/abs/2604.13630) | Apr 2026 | Lifecycle-integrated gates, tiered verification |
| AgentSPEX | [2604.13346](https://arxiv.org/abs/2604.13346) | Apr 2026 | Explicit step types as structural gates |
| SEVerA (FGGM) | [2603.25111](https://arxiv.org/abs/2603.25111) | Mar 2026 | Formal pre-commitment contracts |
| Verifier Tax | [2603.19328](https://arxiv.org/abs/2603.19328) | Mar 2026 | ⚠️ Terminal verification trap, recovery failure |
| AgentProcessBench | [2603.14465](https://arxiv.org/abs/2603.14465) | Mar 2026 | Step-level quality, ternary classification |
| Workflow Optimization Survey | [2603.22386](https://arxiv.org/abs/2603.22386) | Mar 2026 | Static vs. dynamic workflow structure |
| Resilient Write | [2604.10842](https://arxiv.org/abs/2604.10842) | Apr 2026 | Pre-flight risk scoring, 13x self-correction |
| UQ as Active Signal | [2601.15690](https://arxiv.org/abs/2601.15690) | Jan 2026 | Uncertainty-driven metacognition (ACL 2026) |
| AgentDebug | [2509.25370](https://arxiv.org/abs/2509.25370) | Sep 2025 | Root-cause isolation, error taxonomy |
| ABBEL | [2512.20111](https://arxiv.org/abs/2512.20111) | Dec 2025 | Belief bottleneck as structural checkpoint |
| Table-Critic | [2502.10178](https://arxiv.org/abs/2502.10178) | Feb 2025 | Judge/Critic separation (ACL 2025) |
| TDAG | [2402.10178](https://arxiv.org/abs/2402.10178) | Feb 2024 | Dynamic task decomposition, error propagation |

---

*Note: Semantic Scholar API was rate-limited during research. Additional references may exist in that index. arXiv full-text search was the primary source.*
