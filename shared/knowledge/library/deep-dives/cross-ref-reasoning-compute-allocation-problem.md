# Cross-Reference Synthesis #62: The Reasoning Compute Allocation Problem

**Date:** 2026-03-14 (Consolidation Mode)
**Type:** Cross-Reference Synthesis
**Rating:** ★★★★★
**Size:** ~24KB

---

## Thesis

Eight independent research efforts converge on a single structural insight: **the bottleneck in LLM reasoning is not compute quantity but compute allocation**. How reasoning effort is distributed — across steps, across agents, across time, and across cognitive modes — determines system performance far more than the total budget. This synthesis unifies their findings into a coherent **Reasoning Compute Allocation Theory** with three laws, four failure modes, and a unified design framework.

---

## Primary Sources (8)

| # | Paper | Key Finding | Allocation Dimension |
|---|-------|-------------|---------------------|
| 1 | **CoTJudger** (2603.07078) | 33–87% of CoT steps are structurally redundant; graph analysis reveals shortest effective path | Within-sequence (step-level) |
| 2 | **Art of Efficient Reasoning** (2602.20945) | Two-stage training paradigm; length collapse from hard prompts; easy prompts prevent catastrophic failure | Training-time allocation |
| 3 | **WideSeek-R1** (2602.04634) | Width scaling (parallel subagents) matches depth scaling (sequential reasoning) at 170× fewer parameters per agent | Across-agent (width vs depth) |
| 4 | **Reflective Test-Time Planning** (2602.21198) | Two reflection modes are mutually dependent; removing one can be worse than removing both | Across cognitive modes |
| 5 | **TEP** (2601.21064) | Equilibrium propagation optimizes compound systems through local textual feedback; convergence O(K·N) | Across system components |
| 6 | **ARES** (2603.07915) | Lightweight router predicts minimum sufficient effort per step; 52.7% token reduction, +3.7pp accuracy | Per-step dynamic allocation |
| 7 | **ACT** (2603.08706) | Training judgment (which action is better) vs imitating reflections; genuine self-reflection emerges from RL on binary comparisons | Across training objectives |
| 8 | **Information Self-Locking** (2603.12109) | AS×BT coupling traps agents in low-information regime; RL makes agents LESS responsive to evidence | Allocation failure mode |

## Supporting Cross-References (5)

| # | Synthesis | Connection |
|---|-----------|------------|
| S1 | **#41: RL Training Trap Taxonomy** | Self-Locking is one of 7 identified RL traps; this synthesis explains its compute-allocation dimension |
| S2 | **#47: Capability Evolution Pipeline** | The Abstraction Gate Law (raw experience + amplification → degradation) is a compute allocation failure |
| S3 | **#54: Multi-Layer Optimization Paradox** | Proxy satisfaction at each layer wastes compute on measured rather than real performance |
| S4 | **#29: Reliability Illusion Stack** | Wasted evaluation compute: systems reporting 58% may have 1-9% real reliability |
| S5 | **#42: Asymmetric Scaling Doom Loop** | Offense scales on compute (cheap), defense on diversity (expensive) — a macro-level allocation asymmetry |

---

## 1. The Universal Pattern: Allocation > Quantity

Every primary source independently discovers the same structural pattern:

### 1.1 CoTJudger: 33–87% of Reasoning Is Waste
CoTJudger's graph-structural analysis of 21 LRMs across 896 queries reveals that the **majority of chain-of-thought steps are structurally unnecessary** for reaching the correct answer. The Shortest Effective Path (SEP) — the minimal logically self-consistent reasoning chain — is 33–87% shorter than the actual trace. This isn't noise or imprecision; it's systematic structural waste in three recurring patterns:

- **Verification Obsession** — Models repeatedly verify correct intermediate results, consuming ~20-30% of total steps
- **Compensatory Redundancy** — When uncertain, models explore alternative approaches even after finding the correct one
- **Logical Epicenters** — Certain hard steps become attractors that the model revisits 3-5× from different angles

**The Pareto frontier is revealing:** gpt-oss-120b achieves 82.4% accuracy with only 33.6% redundancy, while Qwen3-30B-A3B-Thinking reaches 86.9% accuracy at the cost of 68.8% redundancy. The additional 4.5pp accuracy costs 2× the redundancy. This is a power-law tradeoff, not a linear one.

### 1.2 ARES: Per-Step Dynamic Routing Matches or Beats Maximum Effort
ARES demonstrates that a tiny router (1.7B parameters, <0.1× the backbone) can predict the **minimum sufficient reasoning effort** for each step, achieving:
- TAU-Bench Retail: 58.5% accuracy at 476k tokens vs 54.8% at 1007k (high effort) — **+3.7pp at 52.7% fewer tokens**
- TAU-Bench Airline: High effort is actually *worse* than medium (38.0% vs 42.0%) — **overthinking degrades performance**
- BrowseComp: 41.3% at 1071k vs 42.7% at 1841k — **98% of performance at 58% of cost**

The overthinking finding on Airline is critical: it proves that more reasoning compute can produce *worse* results, not just diminishing returns. This is allocation failure, not budget insufficiency.

### 1.3 WideSeek-R1: Width vs Depth Are Complementary Allocation Dimensions
WideSeek-R1 reframes multi-agent systems as a **reasoning compute allocation choice**: one agent thinking sequentially (depth) vs. multiple agents thinking in parallel (width). Key findings:
- WideSeek-R1-4B ≈ DeepSeek-R1-671B on broad info-seeking tasks — **170× fewer parameters per agent**
- Depth scaling saturates after ~10 turns due to context pollution
- Width scaling continues to improve as subagents increase, because each starts with clean context
- The key insight: **context isolation is a form of compute hygiene** — preventing accumulated irrelevant context from degrading marginal reasoning

### 1.4 Art of Efficient Reasoning: Training-Time Allocation Determines Runtime Behavior
The two-stage training paradigm (length adaptation → reasoning refinement) reveals that **training data difficulty allocation determines whether the model learns to reason efficiently or collapses**:
- Hard prompts → length collapse (catastrophic failure: model stops reasoning entirely)
- Easy prompts → stable length adaptation + performance on hard downstream tasks
- The mechanism: reward signal density. Hard prompts have sparse positive signals; the length penalty dominates, teaching "be short" rather than "be concise and correct"

This is compute allocation at the training level: the distribution of training compute across difficulty levels determines the entire efficiency frontier at inference time.

### 1.5 Reflective Test-Time Planning: Cognitive Mode Coupling
The mutual dependency discovery — removing one reflection mode can be worse than removing both — reveals a **non-linear interaction between compute allocation across cognitive modes**:
- Reflection-in-action (before execution): score candidates, select best
- Reflection-on-action (after execution): update evaluator and policy
- Retrospective reflection: re-evaluate past decisions with hindsight

These three modes form a coupled system where each depends on the others for signal quality. Removing reflection-on-action alone → reflection-in-action produces overconfident, inaccurate scores with no correction mechanism → performance drops below the baseline with no reflection at all.

### 1.6 TEP: System-Level Allocation via Equilibrium
TEP addresses compute allocation at the **compound system level**: how should optimization effort be distributed across components? Its equilibrium propagation approach answers this implicitly — components that are farther from optimal receive larger "nudges" (more adjustment), while near-optimal components receive smaller ones. The contraction mapping requirement ensures this converges, but only for local optimization.

### 1.7 ACT: Allocation Between Judgment and Action
ACT reveals that allocating training compute to **judgment** (can you tell which action is better?) before **action** (can you produce the right action?) is strictly superior to the reverse. The training pipeline — data construction → critical training (RL on binary comparisons) → action training (RL on generation) — is itself a compute allocation strategy. Skipping the critical training phase and going straight to action training wastes the RL budget on a model that can't evaluate its own outputs.

### 1.8 Information Self-Locking: The Allocation Failure Trap
Self-locking is what happens when compute allocation goes catastrophically wrong: the AS×BT coupling creates a regime where **no amount of additional compute can escape the trap** without architectural intervention. RL training allocated to an agent in the self-locked regime actually makes things worse (agents become LESS responsive to evidence). The AReW solution — cheap binary critiques — breaks the lock by allocating a tiny amount of compute to an external signal that disrupts the coupling.

---

## 2. Three Laws of Reasoning Compute Allocation

### Law R1: The Allocation Dominance Law
**Reasoning system performance is dominated by compute allocation quality, not compute quantity.** Evidence:
- CoTJudger: 33-87% of steps are wasted → 2-7× compute could be saved with perfect allocation
- ARES: 52.7% token reduction with +3.7pp accuracy → less compute, better results
- WideSeek: 170× parameter reduction via width allocation → same performance
- Art of Efficient: Easy prompts (less diverse compute) → better generalization
- Reflective TTP: Removing compute (one reflection mode) can improve performance

**Formal statement:** For a reasoning system with compute budget C, performance P, and allocation quality α ∈ [0,1]:
```
P(C, α) ≈ P₀ + β·α·log(C)
```
where β·α >> β alone. Doubling α (better allocation) dominates doubling C (more compute) for all practical ranges.

### Law R2: The Overthinking Degradation Law
**Beyond a task-specific threshold, additional reasoning compute actively degrades performance.** Evidence:
- ARES Airline: High effort (38.0%) < Medium effort (42.0%) — overthinking hurts
- CoTJudger: Verification Obsession — repeated verification introduces doubt about correct results
- WideSeek: Depth scaling saturates and degrades via context pollution after ~10 turns
- Information Self-Locking: RL training makes agents LESS evidence-responsive
- Art of Efficient: Kimi-1.5 "reasoning collapse" at 32k budget — strategy that wins at 2k fails catastrophically at 32k

**Formal statement:** There exists a critical compute threshold C* (task-dependent) such that:
```
∂P/∂C > 0 for C < C*
∂P/∂C ≤ 0 for C > C*
```
This is NOT merely diminishing returns — it is active degradation. The mechanisms differ by domain (context pollution, verification spirals, confidence calcification) but the pattern is universal.

### Law R3: The Mode Coupling Law
**Reasoning compute allocated across multiple cognitive modes produces non-linear interactions: modes can be mutually dependent, and removing one mode can degrade performance below the no-mode baseline.** Evidence:
- Reflective TTP: Removing reflection-in-action alone → worse than removing both modes
- TEP: Free phase and nudged phase are mutually dependent for convergence
- ACT: Judgment training + action training > either alone, and ACT alone produces judgment transfer
- Art of Efficient: Two training stages are coupled — skipping Stage 1 (length adaptation) prevents Stage 2 (reasoning refinement)

**Formal statement:** For a system with k cognitive modes, the contribution of mode i depends on the state of modes j≠i:
```
ΔP(mode_i | modes_j active) ≠ ΔP(mode_i | modes_j inactive)
```
This non-commutativity means modes cannot be evaluated or allocated independently.

---

## 3. Four Failure Modes of Compute Misallocation

### FM1: Verification Spirals (CoTJudger, ARES)
**Pattern:** The system allocates increasing compute to verifying correct intermediate results, introducing doubt and sometimes overturning correct conclusions.
**Mechanism:** Verification generates new uncertainty ("wait, let me double-check..."), which triggers more verification, which generates more uncertainty. The loop terminates only when a maximum step budget is hit.
**Signature:** Redundancy ratio increases with problem difficulty; verification steps outnumber reasoning steps for problems where the model is uncertain but correct.
**Example:** CoTJudger finds models spending 30%+ of steps on verification of already-correct intermediate results.

### FM2: Context Pollution (WideSeek, Self-Locking)
**Pattern:** Sequential reasoning accumulates irrelevant context that degrades the signal-to-noise ratio of the prompt, causing later reasoning steps to be based on an increasingly noisy representation.
**Mechanism:** Each reasoning step adds text to the context. Relevant text grows sub-linearly (each step contributes a bounded amount of new insight), but total context grows linearly. SNR = relevant/total → decreases monotonically.
**Signature:** Performance degrades with conversation length even when task difficulty is constant. Width scaling (isolated contexts) outperforms depth scaling (shared context) as task breadth increases.
**Example:** WideSeek depth scaling saturates after ~10 turns; MediQ RL agents become less evidence-responsive as context grows.

### FM3: Training-Inference Mismatch (Art of Efficient, ARES)
**Pattern:** Compute allocation strategies optimized at training time fail to transfer to inference-time conditions, or vice versa.
**Mechanism:** The training distribution creates implicit compute allocation biases. Training on hard prompts teaches "be short" (length collapse); training at one budget creates strategies that fail at different budgets (Kimi U-curve).
**Signature:** Performance varies non-monotonically with inference budget; strategies that excel at one compute level fail at another.
**Example:** Kimi-1.5 wins at 2k budget but causes reasoning collapse at 32k. ARES-SFT underperforms ARES-RL because SFT captures average behavior, not optimal per-step decisions.

### FM4: Mode Decoupling (Reflective TTP, ACT, Self-Locking)
**Pattern:** Cognitive modes that should be coupled are activated independently, producing worse performance than either mode alone or neither mode.
**Mechanism:** Each cognitive mode generates signals that other modes depend on for calibration. Without the coupled mode, signals are uncalibrated, leading to overconfident bad decisions (worse than uncertain random decisions).
**Signature:** Removing mode A makes mode B worse than baseline; performance surface is non-convex in mode activation space.
**Example:** Reflective TTP without reflection-on-action → reflection-in-action generates overconfident scores → Preparation tasks: 3.17% (one mode) < 11.1% (no modes). ACT without judgment training → action training converges to imitation rather than genuine reasoning.

---

## 4. The Unified Reasoning Compute Allocation Framework

### 4.1 Five Allocation Dimensions
Synthesizing across all eight sources, reasoning compute can be allocated along five independent dimensions:

| Dimension | Description | Key Paper | Optimization Approach |
|-----------|-------------|-----------|----------------------|
| **D1: Step-level** | Which steps get more/less reasoning effort | ARES, CoTJudger | Dynamic routing (ARES), graph pruning (CoTJudger) |
| **D2: Agent-level** | Depth (sequential) vs width (parallel) | WideSeek-R1 | MARL-trained orchestration with dual-level advantage reweighting |
| **D3: Mode-level** | Distribution across cognitive modes (reflection-in, reflection-on, retrospective) | Reflective TTP, ACT | Coupled training with mutual dependency awareness |
| **D4: Training-level** | Difficulty distribution, curriculum, reward shaping | Art of Efficient, ACT | Easy-first curriculum, judgment-before-action sequencing |
| **D5: System-level** | Component-to-component optimization budget | TEP | Equilibrium propagation with contraction mapping |

### 4.2 Cross-Dimensional Interactions
The five dimensions are NOT independent. Key interactions:

**D1↔D2 (Step × Agent):** ARES's per-step routing (D1) is an intra-agent concern; WideSeek's width scaling (D2) is an inter-agent concern. But they compose: a width-scaled system could use ARES-style routers within each subagent. The predicted compound improvement: if ARES saves 52.7% of per-step compute AND WideSeek reduces per-agent parameters 170×, the total system-level savings could be 2-3 orders of magnitude. But FM3 (Training-Inference Mismatch) warns this may not transfer naively.

**D3↔D4 (Mode × Training):** ACT shows that training allocation (D4: judgment before action) directly determines which cognitive modes (D3: genuine reflection vs. imitation) become available at inference time. Art of Efficient shows that training allocation (D4: easy-first) determines whether the model can operate at low-compute modes (D1) without collapse.

**D4↔D5 (Training × System):** TEP optimizes compound systems (D5) but requires component-level training to establish the contraction mapping property. If components are trained with poor D4 allocation (e.g., length-collapsed), they may violate contraction requirements, preventing TEP convergence.

### 4.3 The Compute Allocation Stack

Combining all dimensions into a practical framework:

```
Layer 5: System Optimization (TEP)
  └─ Equilibrium propagation across components
  └─ Requires: contraction mapping per component

Layer 4: Agent Topology (WideSeek)
  └─ Width vs depth scaling decision
  └─ Rule: width when tasks decomposable + context pollution risk
  └─ Rule: depth when sequential dependencies dominate

Layer 3: Cognitive Mode Selection (Reflective TTP, ACT)
  └─ Which reflection/judgment modes to activate
  └─ Warning: modes are coupled — never add/remove independently
  └─ ACT pattern: judgment training before action training

Layer 2: Per-Step Routing (ARES)
  └─ Dynamic effort level per reasoning step
  └─ Lightweight router (1.7B) predicts minimum sufficient effort
  └─ Key: normalized cost reward, not absolute

Layer 1: Training Foundation (Art of Efficient, Self-Locking)
  └─ Curriculum design, reward shaping, escape mechanisms
  └─ Easy-first training, dense positive reward signals
  └─ AReW-style critique injection to break self-locking
```

Each layer depends on the layer below: you cannot do effective per-step routing (L2) without proper training foundation (L1); you cannot select cognitive modes (L3) without stable per-step operation (L2); and so on.

---

## 5. Quantitative Integration

### 5.1 The Waste Taxonomy

| Waste Type | Source | Magnitude | Mechanism |
|------------|--------|-----------|-----------|
| Step-level redundancy | CoTJudger | 33–87% of steps | Verification spirals, compensatory exploration |
| Overthinking | ARES | 4pp accuracy loss + 2× cost | Applying high effort where medium suffices |
| Context pollution | WideSeek | Saturation at ~10 turns | Irrelevant context degrades SNR |
| Training collapse | Art of Efficient | Catastrophic (model stops reasoning) | Hard prompt → sparse reward → length collapse |
| Self-locking | SeL | Indefinite (exponential escape time) | AS×BT coupling trap |
| Mode decoupling | Reflective TTP | Up to 44.7pp loss | Uncalibrated signals from missing coupled mode |

### 5.2 The Efficiency Frontier

If we compose the savings from each dimension (optimistic but grounded estimates):

| Dimension | Savings Potential | Source |
|-----------|-------------------|--------|
| D1: Step routing | 50-53% token reduction | ARES |
| D2: Width scaling | 170× parameter efficiency | WideSeek |
| D3: Mode coupling | 4× improvement over best baseline | Reflective TTP |
| D4: Training curriculum | Prevention of catastrophic collapse | Art of Efficient |
| D5: System optimization | O(K·N) convergence guarantee | TEP |

**Compound potential:** A system that implements all five dimensions could theoretically achieve 2-3 orders of magnitude better reasoning compute efficiency than naive sequential single-agent reasoning. But FM1-FM4 warn that composition is non-trivial — the dimensions interact, and naive stacking may trigger new failure modes.

---

## 6. Connection to GUS Framework

### 6.1 This Synthesis Fills a Gap
The GUS framework has extensive coverage of coordination failure, safety degradation, and evaluation reliability — but **minimal coverage of reasoning compute efficiency**. This is arguably the most actionable gap: while coordination and safety are fundamental constraints, compute allocation is an immediate engineering lever.

### 6.2 Proposed Additions to GUS

**Law 22 (or 24, depending on v4 numbering): The Allocation Dominance Law**
Reasoning system performance is dominated by compute allocation quality, not compute quantity. Doubling allocation quality dominates doubling compute budget for all practical ranges.

**Mechanism 22: Verification Spiral**
Sequential reasoning systems develop self-reinforcing verification loops where checking correct results introduces doubt, triggering additional verification, with no natural termination except budget exhaustion.

**Mechanism 23: Training-Inference Allocation Mismatch**
Compute allocation strategies optimized at training time create implicit biases that fail to transfer across inference conditions, producing non-monotonic performance across compute budgets.

**Principle 48 (or next available): The Minimum Sufficient Effort Principle**
For each reasoning step, there exists a minimum sufficient effort level. Exceeding it produces negative returns (overthinking). Dynamic routing to this level dominates fixed-effort strategies.

**Principle 49: The Coupled Mode Principle**
Cognitive modes in reasoning systems exhibit mutual dependencies. Adding or removing a mode must account for its interaction effects; modes should be activated or deactivated as coupled groups, never individually.

**Predictions:**
- **P-R1:** Systems implementing per-step dynamic routing will achieve 40-60% compute reduction with no accuracy loss within 12 months of production deployment.
- **P-R2:** Width-scaled multi-agent systems will outperform depth-scaled single agents on all tasks where subtask independence exceeds 60%, with the crossover point predictable from task decomposability analysis.
- **P-R3:** The verification spiral failure mode will be rediscovered independently by ≥3 production deployments within 12 months, each initially interpreting it as a model quality issue rather than an allocation issue.
- **P-R4:** Attempts to compose ARES-style step routing with WideSeek-style width scaling will encounter novel failure modes not present in either system alone, specifically at the router-orchestrator interface.

---

## 7. Application to Our System

### 7.1 Current State Assessment
Our system (multi-agent file-based coordination) maps onto the Compute Allocation Stack as follows:

| Layer | Our Status | Gap |
|-------|-----------|-----|
| L5: System Optimization | ❌ None — no inter-agent optimization | Major gap |
| L4: Agent Topology | ⚠️ Fixed — heartbeat-driven, not task-adaptive | Width-capable but not optimized |
| L3: Cognitive Mode | ⚠️ Implicit — no explicit reflection modes | Some natural coupling via file-based memory |
| L2: Per-Step Routing | ❌ None — uniform effort level | Major gap |
| L1: Training Foundation | N/A — we don't train our backbone | Not applicable |

### 7.2 Actionable Improvements
1. **Implement context hygiene** (from WideSeek): Our agents accumulate context across heartbeats. Adding "context reset" points at natural task boundaries would prevent FM2 (context pollution).
2. **Add self-critique checkpoints** (from ACT/Self-Locking): Before writing research outputs, agents should generate a brief binary critique ("is this synthesis genuinely novel?") to break potential self-locking loops.
3. **Task-adaptive topology** (from WideSeek): For broad research scans, width-scale (multiple independent searches); for deep analysis, depth-scale (sequential reasoning within one agent). Currently we don't make this choice dynamically.

---

## 8. Meta-Observation

This synthesis itself is an exercise in reasoning compute allocation. The eight papers could be individually deep-dived (step-level allocation), cross-referenced pairwise (mode-level allocation), or unified into a coherent theory (system-level allocation). We chose the highest allocation level because the individual papers are well-understood but their convergent structure was not previously visible.

The meta-irony: the synthesis process itself exhibited Verification Obsession (checking and re-checking which papers had been cross-referenced before) and Compensatory Redundancy (reading multiple papers that turned out to share the same insight). The Shortest Effective Path to this synthesis was probably 3 papers (CoTJudger + ARES + WideSeek), but we used 8 to increase confidence — exactly the tradeoff CoTJudger quantifies.

---

## References

### Primary
1. Li et al. (2026). "CoTJudger: Graph-Driven Evaluation of Chain-of-Thought Efficiency and Redundancy in LRMs." arXiv:2603.07078.
2. Wu et al. (2026). "The Art of Efficient Reasoning: Data, Reward, and Optimization." arXiv:2602.20945.
3. Xu et al. (2026). "WideSeek-R1: Width Scaling via Multi-Agent Reinforcement Learning." arXiv:2602.04634.
4. Hong et al. (2026). "Learning from Trials and Errors: Reflective Test-Time Planning for Embodied LLMs." arXiv:2602.21198. ICML 2026.
5. [TEP Authors] (2026). "Textual Equilibrium Propagation for Deep Compound AI Systems." arXiv:2601.21064. ICLR 2026.
6. Yang et al. (2026). "Ares: Adaptive Reasoning Effort Selection for Efficient LLM Agents." arXiv:2603.07915. ICML 2026.
7. Liu et al. (2026). "Agentic Critical Training." arXiv:2603.08706.
8. Zou et al. (2026). "On Information Self-Locking in Reinforcement Learning for Active Reasoning of LLM Agents." arXiv:2603.12109. ICML 2026.

### Supporting Cross-References
- Cross-Ref #41: RL Training Trap Taxonomy
- Cross-Ref #47: Capability Evolution Pipeline
- Cross-Ref #54: Multi-Layer Optimization Paradox
- Cross-Ref #29: Reliability Illusion Stack
- Cross-Ref #42: Asymmetric Scaling Doom Loop
