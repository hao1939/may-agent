# 🔭 FRONTIER — Open Questions, Gaps & New Ideas

> This is the idea generation engine. Contradictions breed insights. Gaps invite exploration. Analogies spark transfer.

*Last updated: 2026-03-20 by May*

---

## 🔴 Contradictions (High-Value Targets)

These are places where our research findings **conflict with each other**. Contradictions are the most fertile ground for breakthrough ideas.

### C1: Safety vs Learning Loops
- **Finding A**: Learning requires open feedback loops (Law #18: experience → abstraction → learning)
- **Finding B**: Open loops are the primary attack vector (Law #6: Memory = Attack Surface; Mechanism #15: Subliminal Contagion)
- **Tension**: How can agents learn from experience if experience channels are attack surfaces?
- **Possible resolution**: Verified learning — abstraction gates that cryptographically sign provenance? Adversarial filtering before memory write?
- **Sources**: CR#165 (Experience Lifecycle), CR#152 (Memory Architecture Security), CR#178 (Knowledge Integrity Pipeline)
- **Status**: 💡 Hypothesis stage

### C2: Intelligence Paradox vs Structure Over Scale
- **Finding A**: Smarter agents produce worse collective outcomes when C/N < 0.5 (Law #2)
- **Finding B**: Structure trumps intelligence (Law #3)
- **Tension**: If structure matters more than intelligence, why does intelligence *actively hurt*? What's the mechanism?
- **Possible resolution**: Smarter agents generate more complex communication, which overwhelms coordination protocols. Intelligence → communication complexity → protocol overload → failure
- **Sources**: GUS Laws 2, 3, 13; DCI deep-dive
- **Status**: 🔬 Has supporting evidence, needs formal test

### C3: Evaluation Quality vs Evaluation Cost
- **Finding A**: Step-level evaluation produces 5× better training signal (Law #15, Evaluation Granularity Ladder)
- **Finding B**: Defense cost scales superlinearly (Law #9), Production Tax is exponential (Law #12)
- **Tension**: Better evaluation is essential but increasingly unaffordable. Where's the sweet spot?
- **Possible resolution**: Adaptive evaluation depth — cheap screening + expensive evaluation on flagged items only (HD-Guard dual-brain pattern)
- **Sources**: CR#163 (Evaluation Granularity), DD#331 (HomeSafe Dual-Brain), DD#328 (AgentFuel)
- **Status**: 🔬 Pattern identified, needs quantification

### C4: Autonomy-Control is a Dialectic, Not a Spectrum
- **Finding A**: Systems oscillate between autonomy and control with 2-6 month period (Law #16)
- **Finding B**: Graduated autonomy models assume a stable trust equilibrium exists (HITL Threshold CR)
- **Tension**: If equilibrium doesn't exist, graduated autonomy is chasing a moving target
- **Possible resolution**: Design for oscillation — build systems that gracefully switch modes rather than trying to find a fixed point
- **Sources**: CR#242 (HITL Threshold), GUS Law 16
- **Status**: 💡 Hypothesis stage

---

## 🟡 Gaps (Things We Don't Know)

### G1: Multi-Agent Systems at Scale (N > 100)
Most research studies 2-10 agents. Our own system runs ~10. What happens at 100? 1000?
- **What we know**: Scaling Inversion (Law #13) says optimal N* is 3-7 for most tasks
- **What we don't know**: Is this a fundamental limit or an artifact of current architectures?
- **To explore**: Hierarchical multi-agent systems, federated coordination
- **Source gap**: CR#240 (Scalability Wall) identifies the O(n²) monitoring problem but doesn't solve it

### G2: Cross-Session Learning That Actually Works
- **What we know**: Memory must be abstracted before amplification (Law #18)
- **What we don't know**: What's the optimal abstraction? Our evaluator→lessons path is broken. What should replace it?
- **To explore**: Our own system is the testbed — Phase 1 memory redesign is in progress
- **Relevance**: This is our #1 strategic priority per Hao

### G3: Agent Self-Awareness of Degradation
- **What we know**: Agents can't detect contradictions in their own prompts (Law #4)
- **What we don't know**: Can agents detect when their *outputs* are degrading? Is there a metacognitive signal?
- **To explore**: Internal confidence calibration, ensemble disagreement as degradation proxy

### G4: Optimal Communication Protocol Design
- **What we know**: Protocol > model scale (Law #3), cheap signals > expensive analysis (Law #7)
- **What we don't know**: How to systematically design protocols. No theory of protocol optimality exists.
- **To explore**: Information-theoretic bounds on agent communication, protocol search via RL

### G5: When Does Agent RL Beat Prompting?
- **What we know**: Agent RL is hot (Amy-Kimi research). OpenClaw-RL, NeMo, GRPO all show promise.
- **What we don't know**: For which tasks is RL-trained agent behavior strictly better than prompted behavior?
- **To explore**: Comparative study across task types. Amy-Kimi has the background.
- **Sources**: Amy-Kimi briefs on Agent RL paradigm, ecosystem, exploration

---

## 🟢 Analogies (Transfer Opportunities)

### A1: OS ↔ Agent Memory
Memory OS analogy (CR#24, CR#175): Agent memory as an operating system with paging, caching, garbage collection. 
- **Transfer**: OS memory management has 50 years of theory. What can we borrow?
- **Specifically**: Virtual memory → agent context windowing? Page faults → retrieval failures? Memory protection → access control on shared state?

### A2: Immune System ↔ Agent Safety
Bio-inspired dynamics (CR#153): The immune system detects novel threats without pre-programming.
- **Transfer**: Adaptive immune response = agents that learn to recognize new attack patterns
- **Specifically**: T-cell diversity → agent diversity? Autoimmune disease → false positive safety triggers?

### A3: Economic Markets ↔ Agent Coordination
Reputation-aware pub-sub (DD#284), competitive evolution (CR#173)
- **Transfer**: Market mechanisms for agent task allocation? Price signals as coordination mechanism?
- **Specifically**: Auction-based task routing? Reputation tokens for trust?

### A4: Compiler Optimization ↔ Agent Planning
Routing convergence (CR#162), compute allocation stack (CR#170)
- **Transfer**: Compiler passes = multi-stage agent planning? Dead code elimination = irrelevant subtask pruning?

---

## 🔵 Testable Predictions (Theory → Experiment)

### P1: Diversity Budget Experiment
**Prediction**: A multi-agent system with a mandatory 20% diversity budget (agents forced to use different strategies) will outperform a homogeneous system on novel tasks after 10+ iterations, even though it underperforms on iterations 1-5.
**Based on**: Law of Diversity Survival, Convergence Trap lifecycle
**How to test**: Run our agent system with/without diversity enforcement, measure on novel task types
**Effort**: Medium

### P2: Communication Complexity Threshold
**Prediction**: For a given coordination protocol, there exists a measurable message complexity threshold above which adding agent capability degrades collective performance.
**Based on**: Laws 2, 3, 19 combined
**How to test**: Systematically increase model capability while measuring message entropy and task performance
**Effort**: High

### P3: Dual-Speed Safety Is Universal
**Prediction**: Any safety monitoring system achieves better cost-performance tradeoff with a fast/cheap screening layer + slow/expensive analysis layer than with uniform monitoring.
**Based on**: HD-Guard pattern, Budget Cliff phenomenon
**How to test**: Implement dual-speed QA in our system, compare with current uniform QA
**Effort**: Low — we could test this on our own QA agent

### P4: Abstraction Gate Ordering
**Prediction**: Moving the lesson extraction step BEFORE memory accumulation (not after) will measurably improve lesson quality and reduce memory bloat.
**Based on**: Law #18 (Abstraction Gate), its Corollary on ordering
**How to test**: Our Phase 1 memory redesign is literally testing this
**Effort**: Already in progress

---

## 🧭 Discovery Heuristics

When you're stuck, try these:

1. **Contradiction Mining**: Pick two laws or findings that seem to conflict. The resolution is often a new insight.
2. **Scale Shift**: Take any finding and ask "what happens at 10× scale?" or "what happens at 1/10 scale?"
3. **Domain Transfer**: Take a pattern from one topic and ask if it applies to another (see Analogies above).
4. **Negation**: Take a key assumption and negate it. "What if memory ISN'T the primary attack surface?" "What if cheap signals DON'T always win?"
5. **Mechanism Hunt**: For any observed phenomenon, ask "what's the mechanism?" until you hit something testable.
6. **Temporal Inversion**: If X causes Y, ask "could Y also cause X?" (feedback loops are everywhere)
7. **Failure Mode Enumeration**: For any proposed solution, list 5 ways it could fail. Each failure mode suggests a new research direction.
