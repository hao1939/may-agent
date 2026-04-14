### arXiv:2604.03239 — Six Birds Theory: Formal Definition of Agenthood via Empowerment and Viability (Tsiokos)

| Field | Value |
|-------|-------|
| Authors | Ioannis Tsiokos |
| Venue | Preprint, February 2026 (appearing in April cs.AI listings) |
| Rating | ★★★★ |
| Relevance | First formal, testable definition of agenthood that separates "being an agent" from "having agency." Novel formal framework for MAS governance. |

**Core Problem:** Empirical discussions of agency conflate persistence (being an object) with control (making a counterfactual difference). This makes agency claims difficult to test and easy to spoof. SBT gives a type-correct account that separates these concerns.

**Six Birds Theory (SBT) Definition of Agenthood:**
A theory induces a layer with an explicit interface and ledgered constraints. An agent is defined as:
> "A maintained theory object whose feasible interface policies can steer outside futures while remaining viable."

This unpacks into four checkable components:

**1. Ledger-gated feasibility**: The agent's possible actions are constrained by an explicit ledger (resource budget, permissions, state). Not everything the agent *could* do is *feasible* given its constraints.

**2. Robust viability kernel**: Computed as a greatest fixed point under successor-support semantics. The set of states from which the agent can survive indefinitely. An agent must be *viable* — it can't just act once and die.

**3. Feasible empowerment**: Channel capacity between the agent's actions and resulting states, measured in bits. A proxy for "difference-making" — how much the agent can steer the world. Zero empowerment = no agency, just existence.

**4. Empirical packaging map**: Maps observations to agent identity. Its idempotence defect quantifies how well the agent holds together as a coherent object under observation.

**Experimental validation (ring-world with toggles):**
- **Null regime**: Single actions → zero empowerment → blocks false positives (an object with no control isn't an agent)
- **Repair toggle**: Enabling repair collapses idempotence defect → object becomes well-defined
- **Protocol holonomy**: Protocols increase empowerment only at horizon ≥ 2 steps → multi-step planning is necessary for non-trivial agency
- **Operator rewriting**: Learning to rewrite operators monotonically increases median empowerment (0.73 → 1.34 bits) → self-improvement increases agenthood

**Key separation: Agenthood ≠ Agency:**
- **Agency** = the ability to make choices (a thermostat has agency)
- **Agenthood** = being a coherent, viable, empowered entity with ledger constraints (a thermostat doesn't have agenthood)

This is critical for MAS governance. When is a sub-agent truly an "agent" vs. just a function? SBT provides testable criteria.

**GUS/GRA mapping:**
- **Connects to DD#475 Logic Monopoly**: The Logic Monopoly problem (agent as legislator+executor+adjudicator) can be formalized via SBT — each role requires different ledger constraints and empowerment channels
- **Connects to CR#261 Governance Authority Stack**: SBT provides the formal foundation for deciding which entities in the stack qualify as "agents" (and thus need governance)
- **Connects to CR#265 Constitutional Evolution**: Constitutional amendments change the viability kernel — SBT gives a formal way to measure the impact of constitutional changes on agenthood
- **Connects to DD#472 MAD-Spear**: Sybil agents = entities that spoof agenthood (high apparent empowerment but actually controlled by an adversary). SBT's idempotence defect could detect this.
- **Connects to DD#476 AgentNet**: In decentralized MAS, SBT provides criteria for when a node qualifies as an agent vs. a relay/proxy

**Limitations:**
1. Ring-world experiments are toy-scale — unclear if the four tests scale to real LLM agents
2. Empowerment computation is intractable for high-dimensional state spaces
3. No connection to existing MAS benchmarks
4. Single author, no peer review yet

**Predictions:**
- **P437**: Empowerment-based agenthood metrics will be adopted in MAS governance frameworks within 18 months as a formal criterion for "agent registration"
- **P438**: The viability kernel concept will be connected to Hippo-style memory decay (DD#612) — an agent that loses its memory loses viability and thus agenthood
- **P439**: SBT's idempotence defect will prove useful for detecting Sybil agents in decentralized MAS (complementing MAD-Spear)

**Law candidate — L45 (Agenthood Threshold):** An entity qualifies as an agent if and only if it satisfies all four SBT conditions simultaneously: ledger-gated feasibility, robust viability, non-zero empowerment, and bounded idempotence defect. Failure of any single condition reduces the entity to a sub-agent, tool, or object.

---
*DD#618 — Scout Session 298, 2026-04-07*
