# Cross-Reference #167: Managing Planning Complexity — Search, Structure, and Separation

**Date:** 2026-03-16
**Type:** Cross-Reference Synthesis
**Rating:** ★★★★★ CRITICAL
**Connected DDs:** DD#287 (ToolTree), DD#286 (STAR), DD#329 (DCI), DD#325 (BASF MAS), DD#291 (ReBalance), DD#322 (ShatterMed-QA), DD#280 (Semantic Invariance)
**Related CRs:** CR#164 (Reasoning-Execution Gap), CR#161 (Multi-Agent Coordination Stack), CR#62 (Reasoning Compute Allocation)

---

## The Core Question

How should AI agents manage planning complexity when action spaces are large, consequences are uncertain, and coordination is required?

Our research portfolio reveals **three competing paradigms**, each with distinct strengths, failure modes, and scalability characteristics:

| Paradigm | Exemplar | Core Mechanism | Planning Horizon |
|----------|----------|----------------|-----------------|
| **Search** | ToolTree (DD#287) | MCTS with dual feedback | Single-agent, deep lookahead |
| **Structure** | DCI (DD#329) + STAR (DD#286) | Typed epistemic acts + role differentiation | Multi-agent, deliberative |
| **Separation** | BASF MAS (DD#325) | Decompose reasoning from execution | Multi-agent, divide-and-conquer |

## Paradigm 1: Search (ToolTree — DD#287)

**Core insight:** Treat planning as a tree search problem with execution-grounded evaluation.

ToolTree applies Monte Carlo Tree Search to tool planning, introducing **bidirectional pruning** — pre-execution filtering (foresight) and post-execution elimination (hindsight). The key innovation is that both LLM judgment AND actual tool execution inform search:

```
UCT(s,a) = Q(s,a) + λ · r_pre(s,a) · √(ln N(s) / N(s,a))
```

**Strengths:**
- Execution-grounded: actual API results inform value estimates (not hypothetical)
- Bidirectional pruning reduces branching factor dramatically
- Single-agent simplicity — no coordination overhead

**Weaknesses:**
- Scales poorly to multi-agent settings (exponential joint action spaces)
- Pre-evaluation depends on LLM judge quality (→ DD#280 semantic invariance concerns)
- No mechanism for opponent modeling or adversarial robustness

**Connection to ReBalance (DD#291):** Both address compute allocation for reasoning. ReBalance operates at the token-generation level (when to stop thinking), ToolTree at the action-planning level (which tool branches to explore). They are **complementary** — ReBalance controls reasoning depth within a node, ToolTree controls search breadth across nodes.

## Paradigm 2: Structure (DCI + STAR — DD#329, DD#286)

**Core insight:** Replace unconstrained search with structured communication protocols and differentiated roles.

DCI introduces 14 typed epistemic acts and 4 reasoning archetypes (Analyst, Advocate, Integrator, Evaluator). STAR adds adversarial evaluation with performance-weighted ELO ratings. Together, they suggest planning complexity is manageable through **protocol engineering** rather than search algorithms.

**DCI's key contribution:** Typed acts (CLAIM, EVIDENCE, ANALYZE, SYNTHESIZE, SUPPORT, OBJECT, CONCEDE, COMMIT...) constrain the space of possible interactions. Instead of exploring all possible message sequences, agents follow a convergent flow algorithm (DCI-CF) that guarantees termination.

**STAR's key contribution:** The zero-sum game formalization reveals that adversarial reasoning requires fundamentally different planning than cooperative planning. Turn-based mode isolates strategic capability; real-time mode reveals the strategy-execution trade-off.

**Strengths:**
- Naturally handles multi-agent settings
- Role differentiation prevents redundant exploration
- Protocol constraints make planning tractable without search
- Preserves disagreement as information (vs. premature consensus)

**Weaknesses:**
- Protocol design requires domain expertise
- Fixed role assignments may not be optimal for all problems
- No mechanism for the kind of "surprising" discoveries that unconstrained search can find

**Connection to Semantic Invariance (DD#280):** DCI's typed epistemic acts may help address the contrastive fragility discovered in DD#280. By requiring agents to commit typed reasoning moves (not free-form text), the system becomes less susceptible to surface-level semantic variations.

## Paradigm 3: Separation (BASF MAS — DD#325)

**Core insight:** Decompose planning into abstract reasoning and concrete execution, handled by different agents.

BASF's two-agent architecture (Process Development Agent + Chemasim Modelling Agent) separates WHAT to do from HOW to do it. The process agent reasons about chemical engineering at the abstract level; the modelling agent translates plans into domain-specific code.

**Strengths:**
- Natural specialization — each agent can be optimized for its role
- Domain-specific knowledge can be injected through context (the "context is all you need" finding)
- Iterative verification (simulate → check convergence → iterate) provides execution grounding
- Demonstrated in actual industrial deployment (BASF)

**Weaknesses:**
- Requires clean decomposition boundaries (not always possible)
- Communication bottleneck between agents limits information flow
- No adversarial robustness mechanism
- Linear pipeline lacks the parallel exploration of search methods

## The Convergence Insight: Hybrid Architectures

The three paradigms are not mutually exclusive. The most capable future systems will likely combine:

1. **Separation** at the architecture level (specialized agents for different aspects)
2. **Structure** at the coordination level (typed communication protocols between agents)
3. **Search** at the decision level (MCTS-like exploration within each agent's domain)

**Evidence for this convergence:**

| Finding | Source | Implication |
|---------|--------|-------------|
| ToolTree's pre-evaluation requires LLM judgment quality | DD#287 | Search needs reliable component agents → Separation |
| DCI's convergent flow guarantees termination | DD#329 | Structure enables predictable coordination → makes Search tractable within structure |
| BASF's unit-by-unit verification | DD#325 | Separation needs feedback loops → borrows from Search |
| ShatterMed's multi-hop reasoning failures | DD#322 | Unstructured reasoning breaks on long chains → needs Structure |
| ReBalance's over/under-thinking detection | DD#291 | Compute allocation applies within any paradigm |

## The ShatterMed Warning (DD#322)

ShatterMed-QA provides a crucial cautionary tale for all three paradigms: models exploit **hub nodes** (shortcuts) in reasoning chains. This applies directly:

- **Search paradigm:** Pre-evaluation may route through "obvious" high-confidence paths that are actually shortcuts → need topology-aware search that avoids high-degree hub nodes
- **Structure paradigm:** If protocols don't force multi-hop reasoning, agents will converge on shortcut answers → DCI's typed acts may help (ANALYZE forces decomposition, OBJECT catches shortcuts)
- **Separation paradigm:** Abstract reasoning agent may propose shortcut solutions that the execution agent can't implement → the implementation failure is actually a feature (it forces deeper reasoning)

## Quantitative Planning Budget Comparison

| System | Planning Budget | Accuracy/Performance | Cost |
|--------|----------------|---------------------|------|
| ToolTree (DD#287) | 10-50 MCTS iterations | +3.1 avg over ReAct/ToT baselines | Medium (actual API calls) |
| ReBalance (DD#291) | 3K token budget | 51.3% (vs 36.8% unbounded R1) | Low |
| STAR Turn-Based (DD#286) | Unlimited deliberation | Strategic capability isolated | High |
| STAR Real-Time (DD#286) | Time-constrained | Reveals strategy-execution gap | Medium |
| BASF Pipeline (DD#325) | Sequential agent calls | Full process design achieved | High |

## Design Recommendations for Multi-Agent Systems

1. **Start with Separation:** Decompose the problem into reasoning and execution roles
2. **Add Structure:** Define typed communication protocols between agents (DCI's taxonomy is a good starting point)
3. **Embed Search where needed:** Use MCTS or similar within individual agents for high-branching decisions
4. **Monitor compute allocation:** Apply ReBalance-like mechanisms to prevent over/under-thinking at every level
5. **Test for shortcuts:** Use topology-aware evaluation (ShatterMed's k-shattering) to ensure genuine multi-hop reasoning

## Open Questions

1. **How do the three paradigms interact under adversarial conditions?** STAR tests adversarial reasoning but only within the Structure paradigm. What happens when adversaries can exploit the boundaries between Search and Structure?
2. **Does the Separation paradigm's communication bottleneck become the dominant failure mode at scale?** BASF works with 2 agents; what about 10? 100?
3. **Can DCI's typed epistemic acts be automatically learned rather than hand-designed?** If so, this would bridge Structure and Search — search over protocol space.
4. **How does Semantic Invariance (DD#280) interact with planning depth?** Does deeper planning amplify or dampen sensitivity to input perturbations?

---

*This synthesis connects 7 deep-dives across the Search-Structure-Separation planning spectrum, revealing that the three paradigms are complementary rather than competing. The next frontier is hybrid architectures that combine all three.*
