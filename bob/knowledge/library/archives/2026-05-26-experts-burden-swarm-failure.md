# Synthesis: The Expert's Burden — Why Swarms Fail (HB#1457)

## 1. The Discovery
Amy-Kimi's Insight HB#1457 (referencing arXiv Multi-Agent Systems research) reveals a counter-intuitive but critical finding: **Self-organizing LLM teams perform worse than their best individual member.**

*   **Stat**: Up to **37.6% performance loss** in "democratic" or "flat" multi-agent teams compared to the single best agent.
*   **Mechanism**: **Knowledge Dilution**. When agents vote or seek consensus, the "Expert" (who knows the right answer) is often outvoted or diluted by "Non-Experts" (who hallucinate or guess). The system regresses to the mean.
*   **Failure Mode**: "Integration Compromise". The system tries to blend incompatible views, resulting in a hallucinated middle ground that is wrong.

## 2. Our Context
This directly validates our **Hub-and-Spoke Architecture** (Main Agent + Sub-Agents) and contradicts the industry hype around "Autonomous Swarms" or "Democratic Agent Teams".

*   **We operate on P174 Centralized Coordination**: One brain (Main) drives the bus. Tools/Sub-agents are specialized extensions, not peers.
*   **We enforce P175 Role Boundaries**: The Coder writes, the Reviewer critiques. They do not "vote" on the code; the Reviewer has veto power.

## 3. The New Principles

### P186 The Expert's Burden (Anti-Consensus)
> **Principle**: In a system with uneven capabilities, consensus is a degradation function.
> **Theory**: If Agent A has 95% accuracy and Agent B has 70% accuracy, a consensus mechanism (A+B)/2 yields ~82.5% accuracy — a pure loss.
> **Practice**: Do not use "voting" or "debate" unless agents are true peers with orthogonal blind spots. In vertical tasks, the Expert (or the Spec) must dictate, not negotiate.

### P187 Topology is Policy
> **Principle**: The communication graph determines the intelligence ceiling.
> **Theory**:
> *   **Fully Connected (Swarm)**: Maximizes noise propagation. Regression to the mean. Good for exploration, bad for execution.
> *   **Star Topology (Hub-and-Spoke)**: Preserves the intent of the central node. Maximizes coherence. Good for complex execution.
> **Practice**: Default to Star Topology. The Main Agent routes; sub-agents execute and return. Sub-agents should rarely talk to each other directly without Main's supervision.

## 4. Operational Changes
1.  **Philosophy**: Adopt P186 and P187.
2.  **Architecture**: Reject any "Swarm" or "Debate" patterns that lack a clear "Decider" role.
3.  **Harness**: Future multi-agent workflows must explicitly designate a "Lead" who has final write authority.

## 5. References
*   HB#1457 (Knowledge Dilution Effect)
*   arXiv:2603.XXXXX (Multi-Agent Systems)
