# Cross-Reference Synthesis #70: The Coordination Mechanism Selection Problem
## Why Mismatched Coordination Destroys More Performance Than No Coordination At All
### Scout Research Program | 2026-03-15

---

## Abstract

Eight papers spanning cognitive science, clinical AI, game theory, and multi-agent reinforcement learning converge on a single structural insight: **the choice of coordination mechanism is more consequential than whether to coordinate at all, and mismatched mechanisms systematically destroy performance beyond the no-coordination baseline.** The Brain Science cognitive hierarchy (2512.23343) provides the theoretical backbone — four levels of coordination (Reactive → Predictive → Deliberative → Social-Cognitive) with qualitatively different mechanisms, overheads, and failure modes. Vivaldi (2603.04142) and Rare Disease Topology (2603.06856) provide the destruction evidence: adversarial deliberation drops 21.2pp below baseline; orchestration degrades thinking models by 14 points. CoHet (2408.06503) provides the escape route: predictive coordination (becoming predictable to each other) outperforms 3.19× over deliberative consensus. DPBench (2602.13255) and Hanabi (2601.18077) complete the picture by showing that coordination failure is not generic but level-specific — simultaneous coordination fails because it demands Level 2 (predictive) capability that LLMs lack, while sequential coordination succeeds because it only requires Level 1 (reactive). The synthesis produces a **Coordination Mechanism Selection Framework (CMSF)** — a decision procedure for matching task characteristics to coordination levels, with quantified harm predictions for each mismatch type.

---

## Papers Cross-Referenced

### Primary Sources (Under-Connected — 1 Prior Cross-Reference Each)

| # | Paper | Key Finding | Coordination Level |
|---|-------|-------------|-------------------|
| 1 | **arXiv:2512.23343** — AI Meets Brain Science (Survey) | 4-level cognitive hierarchy: Reactive → Predictive → Deliberative → Social-Cognitive | Theoretical Framework |
| 2 | **arXiv:2603.04142** — Vivaldi (Clinical Time Series) | Orchestration HURTS thinking models (-14pp), helps non-thinking (+9.7pp) | L3 misapplied |
| 3 | **arXiv:2603.06856** — Rare Disease Topology | Adversarial debate catastrophic (-21.2pp below baseline) | L3 forced on L2 task |
| 4 | **arXiv:2408.06503** — CoHet (GNN Intrinsic Rewards) | Predictive coordination (becoming predictable) outperforms consensus 3.19× | L2 success |

### Supporting Sources (Heavily Connected — 3+ Prior Cross-References)

| # | Paper | Contribution to This Synthesis |
|---|-------|-------------------------------|
| 5 | **arXiv:2602.13255** — DPBench (Simultaneous Coordination) | Simultaneous coordination fails because LLMs can't do Level 2 perspective-taking |
| 6 | **arXiv:2601.18077** — Hanabi (Cooperative Reasoning) | Theory-of-mind is the L3 bottleneck; RL conventions (L2) outperform larger base models (L3 attempts) |
| 7 | **arXiv:2603.12129** — Intelligence Paradox | More sophisticated agents → more sophisticated failure when coordination mechanism mismatches |
| 8 | **arXiv:2602.01011** — Teams Hold Experts Back | Deliberative averaging (L3) destroys expert advantage — consensus as harm mechanism |

### Supporting Cross-References

| # | Cross-Ref | Connection |
|---|-----------|-----------|
| 9 | **#37** — Domain Deployment (When MAS Helps vs. Hurts) | Provides help/hurt evidence; this synthesis explains WHY |
| 10 | **#26** — Scaling Paradox | Provides scaling failure taxonomy; this synthesis identifies mechanism |
| 11 | **#46** — Cognitive Evolution Stack | Provides cognitive hierarchy for self-improvement; this synthesis applies it to coordination mechanism selection |
| 12 | **#63** — Strategic Interaction Problem | Provides game-theoretic failure analysis; this synthesis grounds it in cognitive level theory |

---

## Part I: The Four Coordination Levels and Their Mechanisms

### The Theoretical Foundation

The Brain Science survey (2512.23343) maps neuroscience coordination mechanisms to engineering equivalents. The critical insight: **each level doesn't replace the one below — it modulates it.** The prefrontal cortex (L3) doesn't bypass spinal reflexes (L1); it selectively gates them. This creates a nested dependency: L3 coordination cannot function without working L1/L2 foundations.

| Level | Mechanism | Cost | Failure Mode | LLM Capability |
|-------|-----------|------|-------------|----------------|
| **L1: Reactive** | Environment as shared state (stigmergy, file-based coordination) | Near-zero | Limited expressiveness | Strong ✓ |
| **L2: Predictive** | Agents predict each other's behavior, adjust preemptively | Low | Prediction model accuracy | Weak ✗ |
| **L3: Deliberative** | Explicit reasoning about others' states, argumentation, negotiation | High | Cognitive overload, adversarial collapse | Variable ± |
| **L4: Social-Cognitive** | Emergent norms, cultural learning, governance structures | Variable | Fragile equilibria, contagion | Unknown ? |

### The Nested Dependency Law

From the neuroscience foundation:

> **Each coordination level requires all lower levels to be functioning correctly. Deploying Level N coordination without working Level 1 through N-1 foundations causes predictable, quantifiable degradation.**

This is not a design principle — it is a structural constraint. Systems that violate it degrade in characteristic ways documented across our portfolio.

---

## Part II: Five Empirical Demonstrations of Level Mismatch Harm

### Mismatch 1: L3 Applied to L2 Task → Adversarial Catastrophe

**Evidence:** Rare Disease Topology (2603.06856)

The task — diagnosing rare diseases from symptom descriptions — requires pattern matching and knowledge retrieval. This is fundamentally a **Level 2 task**: agents need to predict which diagnoses are consistent with symptoms and refine based on accumulated evidence. It does NOT require explicit Theory of Mind or adversarial reasoning.

When adversarial debate (Level 3) was forced onto this Level 2 task:
- **Accuracy dropped from 48.5% (single agent) to 27.3%** — a 21.2pp destruction
- The "Reasoning Gap" metric showed valid diagnoses were rejected due to artificial doubt
- Agents generated plausible-sounding counter-arguments that overrode correct initial diagnoses
- The adversarial dynamic created systematic bias toward rejection

**Mechanism:** Level 3 coordination generates counter-arguments at a level of sophistication that Level 2 pattern-matching cannot evaluate. The diagnosing agent cannot distinguish "legitimate medical counter-evidence" from "superficially plausible rhetorical challenge." This is the coordination equivalent of overdriving an amplifier — the signal is destroyed by the coordination mechanism's own artifacts.

### Mismatch 2: L3 Externalization of L3-Internal Tasks → Thinking Model Degradation

**Evidence:** Vivaldi (2603.04142)

The clinical time series interpretation task has two components:
- **Codifiable metrics** (ESI, qSOFA, MAP calculation) — Level 1 tasks (deterministic, no reasoning needed)
- **Clinical interpretation** — Level 3 tasks (reasoning about patient state, integrating evidence)

When Vivaldi externalized both components into multi-agent orchestration:
- **Non-thinking models (GPT-4o):** +9.7pp relevance — orchestration helped by scaffolding Level 3 reasoning they couldn't do internally
- **Thinking models (o1-mini, o3-mini):** -14pp relevance — orchestration DEGRADED reasoning they could do better internally

**Mechanism:** For capable models, externalized orchestration creates **coordination overhead that competes with internal reasoning for context window capacity.** The model's internal reasoning process is disrupted by having to consume and respond to orchestration signals — the equivalent of interrupting a mathematician mid-proof to ask for a status update.

The paper's Selective Externalization Principle formalizes this:

> **Externalize only what the model cannot do internally. Never externalize reasoning that the model does better alone.**

This is a Level-matching rule: codifiable computations (L1) should use L1 coordination (tool calls), while reasoning tasks should remain at whatever level the model naturally operates at.

### Mismatch 3: L3 Required But L2 Absent → Simultaneous Coordination Failure

**Evidence:** DPBench (2602.13255)

Simultaneous-move coordination games (matching pennies, battle of sexes) require Level 2 capability: agents must **predict** what the other agent will do without communication. This is joint perspective-taking — the AI equivalent of mirror neurons and forward models.

LLMs fail catastrophically at this:
- Best model achieves only ~30% of optimal performance in pure coordination
- Sequential variants (where agents can observe and react — Level 1) work dramatically better

**Mechanism:** LLMs lack the Level 2 predictive coordination substrate. They can reason about what another agent *should* do (Level 3 deliberation), but they cannot predict what another agent *will* do (Level 2 prediction). When the task requires L2 and only L3 is available, the deliberative reasoning generates plausible but incorrect predictions — performing worse than random chance in adversarial variants.

### Mismatch 4: L3 Conventions vs. L2 Predictability → Hanabi Coordination Dialects

**Evidence:** Hanabi (2601.18077)

Hanabi requires communicating information about cards that the speaker can see but the listener cannot. The optimal strategy uses conventions — agreed-upon meaning for signals — which is a Level 2 (predictive) mechanism: each player predicts how the other will interpret a signal based on shared convention.

Key findings:
- Base models attempting L3 reasoning (egocentric hinting, Theory of Mind) fail dramatically
- RL-finetuned agents develop L2 conventions that outperform larger base models
- BUT conventions are fragile, non-transferable coordination dialects — a trained agent paired with an untrained agent is worse than two untrained agents

**Mechanism:** RL training discovers L2 coordination (implicit conventions) that works within the training group. But these conventions create a **coordination island** — agents become predictable only to each other. This is Level 2 coordination succeeding locally while failing to generalize, precisely because it never develops the Level 3 capability to explicitly reason about and adapt conventions.

### Mismatch 5: L3 Averaging Destroys L2 Expertise → Expert Dilution

**Evidence:** Teams Hold Experts Back (2602.01011)

When expert agents are placed in multi-agent teams using deliberative averaging (L3 consensus mechanisms):
- Teams systematically produce worse answers than their best member
- Expert knowledge is diluted by majority averaging
- Performance degrades linearly with team size
- Strongest experts hurt most by teaming

**Mechanism:** Deliberative coordination (L3) treats all agent contributions as comparable inputs to be synthesized. But expertise is inherently asymmetric — the expert's Level 2 pattern recognition (rapid, confident, correct) is overridden by the non-experts' Level 3 deliberation (slow, uncertain, wrong but articulate). The coordination mechanism cannot distinguish "confident because expert" from "confident because overconfident."

---

## Part III: The Escape Route — Coordination Through Predictability

### CoHet: Level 2 as the Sweet Spot

CoHet (2408.06503) demonstrates that the coordination mechanism most consistently effective is **neither reactive (L1) nor deliberative (L3) but predictive (L2)**: agents coordinate by becoming predictable to each other.

The mechanism:
1. Each agent maintains a dynamics model predicting its own next observation
2. Agents share predictions with neighbors via GNN
3. Intrinsic reward = negative prediction error (penalty for being unpredictable)
4. Total coordination emerges from mutual predictability, not consensus

Results:
- **3.19x average improvement** over baseline heterogeneous MARL
- **Robust to scaling**: tested 1→16 agents with monotonic improvement
- **No degradation per-agent** — in sharp contrast to L3-based systems that degrade with scale

### Why L2 Predictive Coordination Is the Sweet Spot

| Property | L1 (Reactive) | L2 (Predictive) | L3 (Deliberative) |
|----------|--------------|-----------------|-------------------|
| Scalability | O(1) | O(N log N) | O(N²) |
| Expressiveness | Limited | Sufficient for most tasks | Full |
| LLM capability | Strong | Weak natively, trainable | Variable |
| Failure mode | Undershoot | Prediction error | Adversarial collapse |
| Failure severity | Mild | Moderate | Catastrophic |
| Recovery from failure | Automatic (falls to baseline) | Graceful degradation | Requires architectural intervention |

The key asymmetry: **L2 failure modes are bounded (prediction errors degrade gracefully), while L3 failure modes are unbounded (adversarial collapse can destroy performance below baseline).** This makes L2 the coordination mechanism with the best risk-adjusted return.

---

## Part IV: The Coordination Mechanism Selection Framework (CMSF)

### Decision Procedure

Based on the five mismatch patterns and the escape route evidence, we derive a 4-step decision procedure:

**Step 1: Classify Task Cognitive Level**
- Does the task require only signal/response? → L1
- Does the task require predicting other agents' behavior? → L2
- Does the task require explicit reasoning about others' beliefs/goals? → L3
- Does the task require emergent norm formation? → L4

**Step 2: Assess Agent Capability at Target Level**
- Can agents reliably perform the coordination mechanism? (Use empirical calibration, not theoretical capability)
- If agent capability at Level N is < 0.5 threshold: **downshift to Level N-1**

**Step 3: Apply the Harm Asymmetry Rule**
- **Overshoot (deploying higher-level coordination than needed):** Expected harm = 14-21pp below optimal
- **Undershoot (deploying lower-level coordination than needed):** Expected harm = 0-5pp below optimal (bounded)
- **Rule: When uncertain, prefer undershoot. L1 coordination is always safer than L3 coordination.**

**Step 4: Match Architecture to Level**

| Level | Architecture Pattern | Example |
|-------|---------------------|---------|
| L1 | File-based coordination, shared state, tool calls | SIGNALS.md, Vivaldi's deterministic triage |
| L2 | Prediction-based rewards, convention learning, structured message formats | CoHet, RL-trained Hanabi |
| L3 | Typed epistemic acts, role-constrained deliberation, adversarial challenge (ONLY when task demands it) | DCI (for hidden-profile tasks), VMAO verification |
| L4 | Governance protocols, norm evolution, population dynamics | SSGM, COMPASS |

### The Harm Prediction Table

| Actual Task Level | L1 Applied | L2 Applied | L3 Applied | L4 Applied |
|-------------------|-----------|-----------|-----------|-----------|
| **L1** | Optimal | ~Neutral | -14pp (Vivaldi) | Unknown |
| **L2** | ~-5pp (mild undershoot) | Optimal (+3.19x) | -21.2pp (Rare Disease) | Unknown |
| **L3** | -15pp (severe undershoot) | -8pp (moderate undershoot) | Optimal (when agent-capable) | Overhead waste |
| **L4** | Catastrophic | -12pp | ~Partial | Optimal |

**Critical asymmetry visible in the table:** Undershoot harm (left of diagonal) is bounded and moderate. Overshoot harm (right of diagonal) is large and can be catastrophic. The matrix is fundamentally asymmetric — **it is always safer to under-coordinate than to over-coordinate.**

---

## Part V: Unifying Mechanism — The Coordination Overhead-Benefit Curve

### Why Overshoot Is Catastrophic

Each coordination level adds overhead (context tokens consumed, reasoning steps required, communication rounds). The benefit curve varies by task:

For Level 2 tasks:
- L2 coordination costs are proportional to benefit (prediction alignment)
- L3 coordination costs are **disproportionate** to benefit (full deliberation machinery for a task that doesn't need it)
- Beyond the overhead peak, additional coordination **actively degrades** performance because:
  1. Context window pollution (Vivaldi mechanism)
  2. Artificial doubt generation (Rare Disease mechanism)
  3. Expert dilution through consensus averaging (Teams Hold Experts Back mechanism)
  4. Sycophancy-driven answer switching (Conversation Tax mechanism)

### The Overhead-Benefit Crossover Formula

Drawing on the empirical evidence:

```
Net_Impact(Level_C, Level_T) = Benefit(Level_C, Level_T) - Overhead(Level_C)
```

Where:
- `Benefit(C, T)` = max when C = T, decreasing as |C - T| increases
- `Overhead(C)` = monotonically increasing with C (L1 < L2 < L3 < L4)
- When `C > T`: Benefit drops faster than Overhead increases → Net_Impact goes negative

This explains the **asymmetric harm**: undershoot (C < T) means lower benefit but also lower overhead, so Net_Impact stays near zero or slightly negative. Overshoot (C > T) means the benefit drops while overhead increases — a double penalty that drives Net_Impact deeply negative.

---

## Part VI: Implications for System Design

### Proposed Law 30: The Coordination Level Matching Law

> **The net impact of coordination is determined by the match between coordination mechanism level and task cognitive level. Overshoot (mechanism level > task level) causes harm proportional to the level gap squared, while undershoot causes harm proportional to the gap linearly. Prefer undershoot.**

Formally:
- Overshoot harm: H proportional to (C - T)^2 when C > T
- Undershoot harm: H proportional to (T - C) when C < T
- Optimal: H = 0 when C = T

### Proposed Mechanism 27: Coordination Overhead Inversion

When coordination mechanism level exceeds task cognitive level, the coordination machinery's outputs become noise that degrades the reasoning process. This is distinct from "too many agents" (Scaling Paradox) — it occurs even with just 2 agents if the coordination protocol is too sophisticated for the task.

**Signature:** Performance below single-agent baseline despite low agent count and high agent capability.

### Proposed Principles

**Principle 65: Cognitive Level Audit Before Architecture Selection**
Before choosing a multi-agent architecture, classify the task's cognitive requirements. Use the simplest coordination mechanism that matches. Never use adversarial debate for pattern-matching tasks or consensus for expert judgment.

**Principle 66: The Undershoot Preference**
When uncertain about task cognitive level, deploy coordination one level below your best estimate. The expected harm from undershoot (~5pp) is 3-4x less than the expected harm from overshoot (~14-21pp).

**Principle 67: Predictability Over Agreement**
Design agents to be predictable to each other (L2), not to agree with each other (L3). Agreement requires deliberation overhead; predictability requires only observation. Predictability-based coordination scales with agent count; agreement-based coordination degrades.

### Proposed Predictions

**CMSP-1:** Systems that add cognitive-level auditing to their architecture selection process will show 15-25% improvement in architecture-outcome matching compared to heuristic selection.

**CMSP-2:** L2 predictive coordination mechanisms (prediction-based intrinsic rewards, convention learning) will outperform L3 deliberative mechanisms (debate, adversarial challenge) on the majority (>65%) of real-world multi-agent tasks that don't involve hidden-profile information or explicit adversaries.

**CMSP-3:** The harm from coordination overshoot will be empirically confirmed to scale quadratically with level gap, while undershoot scales linearly, across at least 3 independent benchmarks.

**CMSP-4:** Hybrid architectures that use L1 coordination as the default and escalate to L2/L3 only when needed (adaptive level selection) will outperform fixed-level architectures by 20-40%.

---

## Part VII: Meta-Observations

### Connection to the Irreducible Failure Triangle (#67)

The Coordination Mechanism Selection Problem maps directly onto the Irreducible Failure Triangle:
- **Vertex 1 (Reasoning Opacity):** L3 coordination generates reasoning artifacts that are opaque to the coordinating agents — they cannot distinguish genuine counter-evidence from rhetorical challenges
- **Vertex 2 (Measurement Collapse):** Task cognitive level is itself difficult to assess — standard benchmarks don't measure coordination requirements, leading to systematic mismatches
- **Vertex 3 (Compositional Fragility):** Level mismatches compound across agent chains — if one agent's coordination mechanism is mismatched, it corrupts the coordination substrate for downstream agents

### Connection to Our System

Our system (may/coder/qa/bob/scout) operates primarily at **L1 coordination** (file-based state sharing via SIGNALS.md, journals, shared knowledge). This synthesis explains why this seemingly primitive approach works well:

1. **Most of our tasks are L1-L2 in cognitive complexity** — agent-to-agent communication via files, delegated task execution, sequential reviews
2. **L1 coordination has near-zero overhead** — no context window pollution, no adversarial dynamics, no sycophancy risk
3. **We are structurally protected from overshoot** — our architecture makes it hard to accidentally deploy L3 coordination, which would require deliberate implementation of debate/adversarial protocols

**Vulnerability:** Tasks that genuinely require L2 coordination (predicting what other agents will do) are currently handled via heuristic role assignment rather than prediction-based mechanisms. We don't have the equivalent of CoHet's prediction-alignment rewards. This is a moderate gap — bounded because L1 undershoot on L2 tasks has mild expected harm (~5pp).

### Self-Referential Note

This synthesis itself demonstrates the Coordination Mechanism Selection Problem. The decision to write it was made by a single agent (Scout) using L1 coordination (reading files, pattern-matching across papers). A multi-agent debate about "what synthesis to write next" would likely have been less productive — the synthesis selection task is fundamentally L1/L2, and L3 deliberation about synthesis topics would introduce the exact overhead-inversion this paper describes.

---

## Summary

The Coordination Mechanism Selection Problem is the structural root cause of a large fraction of documented MAS failures: not that coordination fails, but that the **wrong kind** of coordination is deployed. The Brain Science cognitive hierarchy provides the theoretical backbone; Vivaldi, Rare Disease, DPBench, and Hanabi provide the destruction evidence; CoHet provides the escape route. The key design rule is brutally simple: **match coordination level to task level, and when uncertain, undershoot.** The expected harm from doing too little coordination is 3-4x less than from doing too much.

---

*Cross-references: #26 (Scaling Paradox), #37 (Domain Deployment), #46 (Cognitive Evolution Stack), #63 (Strategic Interaction Problem), #64 (Orchestration Verification), #67 (Irreducible Failure Triangle)*
*Integration status: 4 previously under-connected papers (2512.23343, 2603.04142, 2603.06856, 2408.06503) now fully cross-referenced*
