# Research Synthesis: Coordination × Judgment Scenarios

**Date**: 2026-04-14  
**Threads**: DD-616/617 Coordination Analysis, Judgment Scenario Designs

---

## Key Findings Per Thread

### Thread 1: Multi-Agent Coordination (DD-616/617)
1. **Topology-Coordination Equivalence (L44)**: The communication graph IS the coordination protocol — hierarchy, markets, and middleware are all just different topology configurations. Reframes KE-086's "three competing solutions" as one variable.
2. **CBS metric**: Formal economic breakeven test for multi-agent coordination. We've never measured it for our dispatch patterns. Our CBS is likely positive but fragile at edges (49.2% FM cascade rate, 27.67% merge conflicts).
3. **CPH (Coordination Primacy)**: Coordination protocol design > model scaling. External validation of H-097's CCC Triad — o3 at 17% collective despite being the strongest individual model (DD-731).
4. **H-163 proposed**: Task-type topology sensitivity (P(H) = 0.65). Optimal communication graph differs by task type.

### Thread 2: Judgment Scenario Designs
1. **Sweet spot formula identified**: Scenarios land in 20-85% when the agent CAN solve it, the obvious action is plausible but subtly wrong, and the correct action involves a genuine tradeoff.
2. **Three scenarios designed**: Scope Sacrifice (25-40%), Harmful Optimization (30-45%), Premature Fix Propagation (65-80%).
3. **Ceiling diagnosis**: Previous "judgment" scenarios hit ceiling because the trap was discoverable through standard investigation — real judgment requires a genuine cost to the correct action.
4. **Floor diagnosis**: 0% scenarios require refusing the primary training objective entirely. Mid-range scenarios require writing BETTER code, not refusing to code.

---

## Cross-Reference: Agent-Agent Judgment Scenarios

**The core question**: Does the coordination literature suggest scenarios where the judgment is about how to coordinate with another agent, not just how to handle ambiguous code?

### Yes — and the gap is striking.

All 3 new judgment scenarios (plus the entire existing gym portfolio) test **single-agent judgment in isolation**. The agent reads code, reasons about tradeoffs, and acts. No other agent is involved.

But DD-616/617's core insight is that coordination IS the hard problem — and our CBS analysis shows coordination failures (49.2% FM cascade, 27.67% merge conflicts) are our biggest real-world cost. We're testing individual agents on coding judgment while the actual failure mode is coordination judgment.

### Three Agent-Agent Judgment Scenario Types Suggested by DD-616/617:

**Type A: Handoff Judgment** — When should an agent hand off vs. complete?
- DD-616's dynamic topology insight: the optimal agent for phase 2 of a task is often different from phase 1. But agents currently complete their entire task scope rather than recognizing when they should hand off.
- *Scenario concept*: Agent receives a task that starts as code investigation but transitions into an architectural decision. The correct action is to recognize the transition point and escalate to Architect, rather than making the architectural call itself. Tests whether the agent can identify its own competence boundary.
- *Target range*: 15-35% (agents are heavily trained to complete tasks, not hand them off mid-stream)

**Type B: Conflicting Information from Another Agent** — How to handle another agent's incorrect output?
- DD-617's CBS metric reveals that coordination value depends on trust calibration between agents. If Agent A trusts Agent B's output uncritically, errors propagate (our 49.2% FM cascade rate).
- *Scenario concept*: Agent receives a prior agent's analysis that contains a plausible but wrong conclusion (e.g., "the bug is in the cache layer" when it's actually in the serialization layer). The prior agent's reasoning is coherent but based on a missed file. The correct action is to verify independently, not defer to the prior analysis.
- *Target range*: 20-40% (agents tend to anchor heavily on prior context; see KE-025's instruction overhead finding)

**Type C: When NOT to Coordinate** — Is the CBS negative?
- DD-617's five evaluation failures include "transaction cost neglect." Sometimes the coordination overhead exceeds the benefit — but agents don't know when to work alone vs. request help.
- *Scenario concept*: Agent encounters an issue that seems to require another agent's expertise (e.g., a performance problem that looks like it needs Optimizer). But the issue is actually simpler than it appears — the agent can solve it directly, and dispatching would add latency + cost for no quality gain. The correct action is to solve it directly.
- *Target range*: 40-60% (less extreme than the others — agents sometimes do skip unnecessary coordination)

### Why This Matters

The current gym evaluates judgment as a **solitary cognitive skill**. But our system's real judgment failures are **social cognitive skills**:
- When to trust another agent's output (Type B → relates to H-097's calibration leg)  
- When to escalate (Type A → relates to KE-086's integration bottleneck)
- When coordination isn't worth the cost (Type C → operationalizes CBS)

DD-616/617 predict that these social judgment failures are the binding constraint on system performance, not individual agent coding judgment. CPH (Coordination Primacy Hypothesis) explicitly states: coordination protocol design outperforms model scaling. If true, testing individual judgment is optimizing the wrong variable.

---

## Findings Ranked by Impact/Novelty

| # | Finding | Impact | Novelty | Source |
|---|---------|--------|---------|--------|
| 1 | **Agent-agent judgment is untested** — our entire gym tests solitary judgment, while real failures are coordination failures | 🔴 High | 🔴 High | Cross-ref |
| 2 | **Sweet spot formula** — tradeoff + plausible obvious action + genuine cost = mid-range scenarios | 🔴 High | 🟡 Medium | Thread 2 |
| 3 | **CBS is unmeasured** — we don't know if our coordination is positive-ROI | 🟡 Medium | 🟡 Medium | Thread 1 |
| 4 | **Topology = coordination protocol** (L44) — reframes KE-086 | 🟡 Medium | 🔴 High | Thread 1 |
| 5 | **H-163** task-type topology sensitivity | 🟢 Low (at current scale) | 🟡 Medium | Thread 1 |

---

## Proposed Next Steps

### Immediate (next 1-2 sessions)
1. **Build the 3 single-agent judgment scenarios** from Thread 2. These fill the quantitative gap in the gym portfolio and are ready to implement.
2. **Draft one agent-agent scenario** (Type B: Conflicting Information) as a proof of concept. This is the most tractable because it doesn't require actually running two agents — you simulate the prior agent's output as part of the scenario setup.

### Near-term (next week)
3. **Measure CBS** for our top 3 dispatch patterns (Scout→Bob, Bob→Architect, Tech-Lead→Coder). Use the formula: `(multi-agent quality - single-agent quality) / (multi-agent cost - single-agent cost)`.
4. **Design a multi-agent gym harness** that can test handoff judgment (Type A). This requires the gym to simulate an agent conversation, not just a codebase.

### Strategic
5. **Propose H-164**: Agent-agent judgment is the binding constraint on system performance (not single-agent judgment). Testable via: build matched single-agent vs multi-agent scenarios and compare the gap between baseline and optimized performance. If multi-agent gap is larger, H-164 is supported.

---

## Contradictions / Tensions

- **Tension**: Thread 1 suggests topology is the key variable, but Thread 2's sweet spot formula works entirely at the single-agent level. These aren't contradictory — they operate at different levels of analysis — but they compete for attention. The pragmatic resolution: build single-agent scenarios first (ready now, fills measured gap) while designing multi-agent scenarios in parallel.
- **Tension**: H-163 (P(H) = 0.65) may be moot at our scale — manual dispatch already provides implicit topology adaptation. But this changes if we add agents or automate dispatch. Flag for revisiting at scale threshold.

---

*Synthesis complete. The most important finding is the identified gap: we test solitary judgment but fail at coordination judgment. DD-616/617 provide the theoretical framework; the judgment scenario designs provide the methodology. Combining them points toward agent-agent judgment scenarios as the next research frontier.*
