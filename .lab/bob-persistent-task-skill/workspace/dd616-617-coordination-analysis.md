# DD-616/617 Coordination Analysis: Agent Q-Mix + Coordination Primacy Hypothesis

**Bob synthesis, 2026-04-14**
**Sources**: DD-616, DD-617, KE-086, H-097, PRIORITY-TRACKER

---

## 1. Does DD-617's CBS (Coordination Benefit Score) apply to our topology?

**Yes — and it reveals we're operating in a regime where CBS is almost certainly positive, but we've never measured it.**

CBS measures the breakeven point: does multi-agent coordination overhead exceed the benefit? For our system:

**Our coordination costs are:**
- Token cost: each agent dispatch includes system prompt (~11-48KB), context injection, task description
- Latency: serial dependency chains (Scout → Bob → Architect has 3x latency of single-agent)
- Error propagation: 27.67% merge conflict rate (CR-316/KE-086), 49.2% FM cascade rate (EXP-099)
- Integration debt: Scout's DD production (expansion) routinely outpaces Bob's KE synthesis (integration) — KE-086's central concern

**Our coordination benefits are:**
- Specialization: Scout explores (discovery), Bob synthesizes (integration), Architect designs (implementation). Different cognitive modes.
- Verification separation: Coach evaluates independently of executor (addresses H-097's calibration leg)
- Context isolation: Each agent operates with bounded context, preventing the saturation that kills monolithic agents (KE-086 Pattern 1, DD-733/H-097)

**Estimated CBS for our system**: Positive, but vulnerable at edges. The DD-617 five evaluation failures are instructive:
1. **Survivorship bias**: We only track agent sessions that complete — interrupted sessions (which are coordination failures) are undercounted
2. **Transaction cost neglect**: We budget $0.05-0.15/gym scenario but don't systematically track coordination overhead in production
3. **Regime-shift blindness**: Our evaluation is primarily on coding/debugging scenarios; multi-agent coordination may behave differently on research/synthesis tasks

**Actionable**: We should compute CBS explicitly for our dispatch patterns. A simple metric: `(multi-agent quality - single-agent quality) / (multi-agent cost - single-agent cost)`. If CBS < 1 for any agent-pair, that link should be questioned.

---

## 2. Does DD-616's dynamic topology suggest adaptive communication?

**Yes — but our system is too small for Q-Mix-style RL optimization. The insight is still valuable at the design level.**

DD-616's core claim: topology selection IS the coordination problem (proposed Law L44: Topology-Coordination Equivalence). Their QMIX approach learns per-round communication decisions.

**Our current topology**: Fixed star-ish with tech-lead as hub, agents as spokes, some agent-to-agent paths (Scout→Bob, Bob→Architect). This is static — every dispatch follows the same graph regardless of task type.

**Where dynamic topology would help us:**

1. **Research vs. implementation mode**: When Bob is doing deep synthesis (like this session), the optimal topology is Scout→Bob (tight research loop). When Bob is writing a design brief, the optimal topology is Bob→Architect→Tech-Lead (tight implementation loop). These use different edges of the communication graph, but the switch is manual (Hao's task assignment), not learned.

2. **Error recovery**: DD-616's strongest practical result is **robustness against agent failure** — topology adapts when agents drop out. Our system has no such capability. If Coach goes down, evaluation stops entirely. If Scout is unavailable, research pauses. Q-Mix-style resilience would route around failures.

3. **Round-wise communication decisions**: In multi-turn tasks, the set of agents involved should change per phase. Phase 1 (explore) → Scout. Phase 2 (synthesize) → Bob. Phase 3 (design) → Architect. Phase 4 (implement) → Coder + Optimizer. Currently this sequencing is hardcoded in workflows. Q-Mix suggests it should be learned.

**But**: DD-616 was tested on systems with 8-512 agents. We have ~7 agents. KE-086 predicts optimal N* ≈ 20-64 for current architectures. We're well below the threshold where dynamic topology optimization pays for itself. The GNN topology encoder, GRU memory, and per-agent Q-heads are massive overhead for a 7-agent system.

**The practical takeaway is not "implement Q-Mix" but "think about topology as a first-class variable":**
- When adding new agent types or dispatch patterns, evaluate the communication graph change, not just the new agent's capability
- Consider task-type-conditional dispatch rules (lightweight version of dynamic topology)
- DD-616's reward design (accuracy + token cost) validates that topology optimization should balance quality and efficiency simultaneously

---

## 3. Connection to KE-086 and H-097

DD-616/617 strengthen two existing threads:

### KE-086 update (Integration Bottleneck)
KE-086 identified three competing solutions: hierarchy (DD-548), markets (DD-553), middleware (DD-579). DD-616 adds a fourth: **learned topology** — RL-optimized communication graph. This is complementary to the other three:
- Hierarchy defines task decomposition → Q-Mix could learn WHEN to decompose hierarchically vs. flat
- Markets define incentive allocation → Q-Mix could learn WHEN market coordination is cost-effective
- Middleware defines communication transformation → Q-Mix could learn WHICH middleware transformations to apply per-round

DD-617's CBS metric provides what KE-086 was missing: a formal economic framework for when multi-agent coordination is worth the overhead. KE-086 identified the integration bottleneck qualitatively; CBS quantifies it.

### H-097 update (CCC Triad)
H-097 claims coordination requires cooperation enforcement, calibrated agreement, and context isolation. DD-617's CPH (Coordination Primacy Hypothesis) provides external validation of H-097's core thesis: coordination protocol design > model scaling.

Specifically:
- CPH validates H-097's "Intelligent Coordination Fallacy" — smarter models don't automatically coordinate better (DD-731: o3 at 17% collective)
- CBS operationalizes one aspect of H-097: if CBS < 1, the coordination mechanism is wrong, regardless of agent capability
- DD-616's topology learning suggests a mechanism for optimizing cooperation enforcement: instead of designing cooperation protocols manually, let the system learn which communication patterns produce best coordination

---

## 4. Testable Hypotheses

### H-163: Task-Type Topology Sensitivity

**Claim**: Our system's performance varies significantly by communication graph topology, and the optimal topology differs by task type. Research tasks (synthesis, hypothesis generation) benefit from tight Scout↔Bob coupling with minimal other agents. Implementation tasks (bug fixes, feature development) benefit from Coder↔Coach coupling with minimal Bob/Scout involvement.

**Operationalization**: Compare current all-dispatch topology vs. task-type-restricted topology for matched tasks. Measure quality and cost.

**Prior**: P(H) = 0.65
- **For**: DD-616 shows topology matters across 7 benchmarks. KE-086 shows different architectural solutions suit different tasks. Our own experience: research sessions don't need Architect/Coder in the loop.
- **Against**: Our system is small enough that unused communication links have near-zero cost (agents aren't invoked unless dispatched). The "topology" is effectively already task-conditional through Hao's manual dispatch decisions.
- **Why 0.65 not higher**: The "against" argument is strong — in a small manually-dispatched system, topology is already implicitly adaptive. The hypothesis matters most if/when we scale to more agents or automate dispatch.

**Falsification**: If quality and cost are indistinguishable between topology configurations across 3+ task types, the hypothesis is falsified.

**Connection**: Extends H-097 (CCC Triad) with topology as the mechanism for structural cooperation. Extends KE-086's "three solutions are complementary" with task-type as the selector variable. Archived H-048 (dynamic topology optimization) is revived here with DD-616 providing the missing mechanism.

### Why this is the right hypothesis (not CBS measurement):
CBS measurement would be useful but isn't a *hypothesis* — it's a metric. The testable question is whether topology configuration actually moves the needle for us at our current scale. If it does, CBS measurement becomes the natural follow-up.

---

## 5. New Knowledge Entry Assessment

**A new KE is warranted**: DD-616/617 together establish a finding that goes beyond existing KE-086. KE-086 covers the integration bottleneck and three architectural solutions. DD-616/617 add:

1. **Topology-Coordination Equivalence** (L44): Topology selection and coordination protocol design are the same optimization — this is a genuinely new insight not captured in KE-086
2. **CBS as coordination ROI metric**: KE-086 describes the problem qualitatively; CBS quantifies it
3. **Coordination > Model Scaling**: KE-086 mentions LLM coordination deficits (DD-573) but doesn't formalize the primacy claim

However, I recommend **updating KE-086** rather than creating a new KE, because the finding naturally extends the existing multi-agent architecture scaling synthesis rather than standing alone. The additions would be:
- Section on "Learned Topology" as 4th architectural solution
- Section on CBS as economic framework for integration bottleneck
- CPH as external validation of the coordination-first thesis

If the knowledge base owner (Bob = me) decides a standalone KE is cleaner, KE-182 would cover "Topology-Coordination Equivalence and the Coordination Primacy Hypothesis."

**Decision: Defer KE creation** until the next KE-086 revision cycle. The findings are noted here and in H-163.

---

## 6. Summary

| Question | Answer |
|----------|--------|
| Does CBS apply to our topology? | Yes. We've never measured it. Positive but vulnerable at edges. |
| Should our communication graph be adaptive? | In principle yes (DD-616). In practice, manual dispatch already provides lightweight adaptation. Matters more at scale. |
| Testable hypotheses? | **H-163** (Task-Type Topology Sensitivity): optimal topology differs by task type. P(H) 0.65. |
| New KE warranted? | Update KE-086 rather than new KE. Defer to next revision cycle. |
| What's genuinely new? | L44 (Topology-Coordination Equivalence) — topology IS the coordination problem, not separate from it. This reframes KE-086's "three competing solutions" as "three topology configurations" — hierarchy, market, and middleware are all just different communication graph structures. |

---

*Analysis complete. 2026-04-14, Bob.*
