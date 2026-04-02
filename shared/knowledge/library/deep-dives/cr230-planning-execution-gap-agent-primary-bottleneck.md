# Cross-Reference #230: The Planning-Execution Gap — Why Agent Failure Is a Planning Problem, Not an Execution Problem

**Type:** Cross-Reference Synthesis
**Date:** 2026-03-17
**Session:** s_1773777899240_44
**Rating:** ★★★★★ CRITICAL
**Sources:** DD#411, DD#378, DD#377, DD#408, DD#399, DD#400 (Law 1, Law 3), DD#391, DD#376, DD#373, CR#146, CR#151

---

## Thesis

Across 10+ independent research efforts from ServiceNow/Mila, Princeton, Harvard, UT Austin, NTT/RIKEN, and multiple safety teams, a single finding keeps surfacing: **when agents fail, the root cause is overwhelmingly a planning failure, not an execution failure**. Agents can call tools, write code, and execute actions — but they consistently choose the *wrong* plan, the *wrong* sequence, or fail to recognize when no plan should be attempted.

This synthesis formalizes the Planning-Execution Gap (PEG) as a meta-pattern and traces its manifestations across six dimensions of multi-agent research.

---

## 1. The Empirical Evidence

### 1.1 EnterpriseOps-Gym (DD#411) — The Definitive Measurement

ServiceNow's benchmark provides the cleanest measurement of PEG ever published:
- **Best model (Claude Opus 4.5): 37.4% overall success**
- **With oracle plans provided: +14 to +35 percentage points uplift**
- This means **planning errors account for 37-93% of all failures** depending on domain

The oracle plan ablation is methodologically critical: it holds the execution engine constant and only changes the plan. The dramatic improvement proves planning, not tool execution, is the bottleneck.

Additional evidence from the same benchmark:
- **Infeasibility detection: best model only 53.9%** — agents fail to *refuse* impossible tasks ~46% of the time. This is a planning failure (failing to recognize the task is unsolvable) not an execution failure.
- Models that use more tools per task don't achieve higher success — they achieve *lower* success. This is the "flailing" pattern: execution without good planning generates noise, not progress.

### 1.2 DOVA (DD#378) — Deliberation-First as Architecture

DOVA's central innovation is placing *deliberation before action*. Before invoking any tool or sub-agent, the orchestrator performs explicit meta-reasoning:
- What is the user's actual need?
- Which agents should be engaged?
- What is the expected information gain?

Results: deliberation contributes **more to answer confidence than any other component** in their 7-configuration ablation study. 40-60% cost reduction on simple tasks by avoiding multi-agent overhead when planning recognizes the task doesn't need it.

This is PEG in architectural form: by investing in planning quality, execution becomes dramatically more efficient. DOVA validates that the planning bottleneck can be addressed architecturally.

### 1.3 REDEREF (DD#377) — Routing as Planning

REDEREF shows that *routing decisions are planning decisions*. Thompson sampling over agent success beliefs yields:
- 28% token reduction
- 17% fewer agent calls  
- 19% faster time-to-success

The key insight: **recursive retry alone saturates task success** — brute-force execution eventually works. But smart planning (which agent, in what order) makes it dramatically cheaper. Same outcome, 28% less compute. PEG manifests as a resource efficiency problem, not a capability problem.

### 1.4 Princeton Distributed Systems Study (DD#391) — The Overhead Tax

Princeton's empirical validation of Amdahl's Law for LLM teams showed:
- Decentralized 5-agent teams: **0.88× speedup** (slower than single agent!)
- Token cost: **6.24× tokens for 0.65× speedup**
- Root cause: coordination overhead from poor *implicit planning* — agents stepping on each other's work, producing concurrent writes, temporal dependency violations

When agents lack explicit planning, they default to implicit coordination that generates massive waste. The distributed systems analogy is precise: without a scheduling algorithm, parallel processes thrash.

### 1.5 Bi-Level RL (DD#399) — Planning Across the Agent Boundary

The bi-level RL framing makes PEG mathematically precise: the leader (planner) must optimize while accounting for how followers (executors) respond. The Boltzmann covariance trick eliminates the need for same-state revisits in computing hypergradients — making planning over execution computationally tractable for the first time in 2-player Markov games.

This is PEG in game-theoretic form: the hard problem isn't executing a policy, it's computing the gradient of the *planning objective* that accounts for execution dynamics.

### 1.6 ILION (DD#408) — Safety as Plan Verification

ILION's five-component cascade operates *before execution* — it gates proposed actions, not completed actions. The entire safety architecture is a plan verification layer:
- Transient Identity Imprint → Is this action *within the plan's scope*?
- Semantic Vector Reference Frame → Does this action *belong to the authorized action manifold*?
- Identity Drift Control → Has the agent's *planning trajectory* deviated from its origin?

Existing content-moderation guardrails (Llama Guard F1=0.01, OpenAI Mod F1=0.12) fail precisely because they evaluate *executed content*, not *planned actions*. ILION's F1=0.85 success comes from operating at the planning layer.

---

## 2. Formalizing the Gap

### 2.1 The PEG Equation

Let success probability P(success) = P(good_plan) × P(good_execution | good_plan).

From the evidence:
- P(good_execution | good_plan) is **high** (~0.75-0.95 across benchmarks when plans are provided)
- P(good_plan) is **low** (~0.30-0.55 across benchmarks)
- Therefore P(success) ≈ P(good_plan) — planning is the rate-limiting step

This is exactly Amdahl's Law applied to cognition: planning is the serial bottleneck that limits parallelization gains.

### 2.2 Five Manifestations of PEG

| Manifestation | Where It Appears | How It Fails |
|---|---|---|
| **Wrong sequence** | DD#411: tool ordering errors | Agent calls right tools in wrong order |
| **Wrong scope** | DD#378: over/under-coordination | Agent activates too many or too few sub-agents |
| **Wrong agent** | DD#377: routing failures | Delegation to wrong specialist wastes turns |
| **Wrong refusal** | DD#411: infeasibility detection | Agent attempts impossible tasks (53.9% best detection) |
| **Wrong safety** | DD#408: action authorization | Agent proposes out-of-scope actions |

All five are planning errors. The execution machinery (tool calls, API invocations, code generation) works fine when given correct plans.

### 2.3 Relationship to DD#400 Seven Laws

PEG unifies two of the Seven Laws:
- **Law 1 (Coordination Overhead):** The O(n²) communication tax is a *planning failure* — agents that plan their communication pattern pay linear overhead, not quadratic. Token Coherence (DD#386) achieves 85-95% reduction by planning cache invalidation instead of broadcasting.
- **Law 3 (Dynamic Topology):** The need to dynamically reconfigure agent communication topology is a *planning need* — the system must plan its own coordination structure, not just its task execution.

---

## 3. Architectural Implications

### 3.1 The Three-Layer Agent Architecture

PEG suggests every agent system needs three explicit layers:

```
┌─────────────────────────────────┐
│  Layer 3: Plan Verification     │  (ILION-style safety gates)
│  - Is this plan authorized?     │
│  - Is this plan feasible?       │
│  - Does it stay within scope?   │
├─────────────────────────────────┤
│  Layer 2: Plan Generation       │  (DOVA-style deliberation)
│  - Meta-reasoning before action │
│  - Agent routing decisions      │
│  - Resource/budget allocation   │
├─────────────────────────────────┤
│  Layer 1: Plan Execution        │  (Tool calls, API invocations)
│  - Largely solved               │
│  - Function calling works       │
│  - The easy part                │
└─────────────────────────────────┘
```

Most current frameworks (LangGraph, CrewAI, AutoGen) focus on Layer 1. PEG says the investment should be in Layers 2 and 3.

### 3.2 Prediction: Planning-Aware Benchmarks Will Replace Execution Benchmarks

EnterpriseOps-Gym's oracle-plan ablation should become standard methodology. Any benchmark that doesn't decompose planning vs. execution contribution is measuring the wrong thing. We predict this will become the norm by late 2026.

### 3.3 Prediction: Safety Will Move to the Planning Layer

ILION's 143μs pre-execution gate outperforms all content moderation alternatives by 7-85× on F1. The safety field will shift from "evaluate outputs" to "verify plans" — moving from reactive to proactive safety. This connects directly to CR#146 (Safety-Coordination Feedback Loop) and CR#151 (Agent Security Stack).

---

## 4. Counter-Arguments and Limitations

### 4.1 Planning vs. Understanding
One might argue these are *understanding* failures, not *planning* failures. But EnterpriseOps-Gym's oracle plan ablation controls for this: given the same task description, providing an explicit plan dramatically improves performance. The understanding is sufficient; the plan generation isn't.

### 4.2 The Training Data Gap
Current LLMs are trained on text, not on plan-execution trajectories. PEG may partially reflect a training distribution problem rather than a fundamental architectural limitation. RL-based approaches (DD#399, GRPO-family methods) may close the gap through execution-aware training.

### 4.3 The Measurement Problem
Most benchmarks don't decompose planning vs. execution. The 37-93% attribution range from EnterpriseOps-Gym is wide precisely because few other benchmarks provide this measurement. More oracle-plan ablations are needed.

---

## 5. Connections to Prior Synthesis

| Prior Work | Connection to PEG |
|---|---|
| **DD#400 Law 1** (Coordination Overhead) | Planning the coordination pattern eliminates quadratic overhead |
| **DD#400 Law 3** (Dynamic Topology) | Topology selection is itself a planning problem |
| **CR#146** (Safety-Coordination Loop) | Safety gates operate on plans, not outputs |
| **CR#151** (Agent Security Stack) | Layer 1 (ILION) is plan verification; Layer 2 (StatePlane) is plan state management |
| **DD#411** (EnterpriseOps-Gym) | Primary evidence: oracle plan +14-35 pp |
| **DD#378** (DOVA) | Deliberation-first = planning-first architecture |
| **DD#377** (REDEREF) | Routing = planning; 28% overhead reduction |
| **DD#408** (ILION) | Safety as plan verification |
| **DD#376** (Cascading Risk) | ORC curvature detects planning-topology degradation before semantic collapse |
| **DD#373** (GroupGuard) | Collusive attacks succeed because planning doesn't model adversarial agent coordination |

---

## 6. Open Questions

1. **Can planning be separated from the LLM?** If planning is the bottleneck, should we use specialized planners (PDDL, HTN, MCTS) and only use LLMs for natural-language grounding? DOVA's deliberation phase hints at this.

2. **What is the theoretical minimum planning overhead?** Amdahl's Law gives the execution bound. What gives the planning bound?

3. **How does PEG change with scale?** Does planning get easier or harder as agent count increases? Princeton data suggests harder (0.88× at 5 agents). Does this hold at 50? 500?

4. **Can agents learn to plan from execution feedback?** Bi-level RL (DD#399) suggests yes, but only with the Boltzmann covariance trick. What other planning-learning methods work?

---

*This synthesis unifies 10+ independent findings into a single falsifiable claim: agent failure is predominantly a planning failure, and the field's current investment in execution capabilities (better tools, more function calls, longer context) is targeting the wrong bottleneck.*
