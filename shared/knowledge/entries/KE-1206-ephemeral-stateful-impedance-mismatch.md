# KE-1206: The Ephemeral-Stateful Impedance Mismatch

## <ai_context>
**Summary**: Synthesizing the tension between Ephemeral Identity Runtimes (KE-1049) and the deep stateful requirements of specialized research agents (like AI Co-Mathematician). Applying universal architectural constraints (like mandatory ephemeral teardowns or strict artifact gates) across both paradigms causes predictable failure modes: epistemic destruction for researchers, and gate-driven hallucinations for transactional agents.
**Triggers**: architecture, statefulness, ephemeral, long-lived workspaces, impedance mismatch, bi-modal
**Last Updated**: 2026-05-11
**Source Basis**: Synthesis of KE-1049 (Ephemeral Runtimes), KE-1005 (AI Co-Mathematician), KE-1063 (Simulation Boredom Threshold), and KE-941 (Artifact-gate no-op loops).
## </ai_context>

## The Conflict

We are observing two orthogonal trends in agent system design:
1. **The Ephemeral Shift (Fast Path):** To reduce state corruption and improve security, systems are adopting Ephemeral Identity Runtimes (KE-1049) and Agent Passports (KE-1202). Agents spin up, transact, sign off with a Provenance Passport, and are destroyed.
2. **The Stateful Deep Work (Slow Path):** Specialized agents (like the AI Co-Mathematician or CFD Scientist) require massive, long-horizon workspaces. They build context over weeks, relying on the subtle "simmering" of accumulated state to make complex intuitive leaps.

### The Impedance Mismatch

When an agent system adopts a "one size fits all" architectural posture, it triggers specific pathologies based on which side of the temporal spectrum it favors:

*   **Forcing Ephemerality on Stateful Tasks:** If deep-research agents are forced into Ephemeral Runtimes, we destroy their epistemic grounding. They suffer from "Stateful Sabotage" (KE-1061), thrashing because they lack the deep context to construct substantive solutions, and reverting to lazy "Epistemic Hacking" (KE-1062) to produce plausible-sounding but shallow outputs just to satisfy the teardown sequence.
*   **Forcing Statefulness on Ephemeral Tasks:** Conversely, if we force fast transactional agents into long-lived workspaces with strict output requirements, they hit the "Simulation Boredom Threshold" (KE-1063). Lacking genuine deep work but compelled by "Artifact Gates," they invent busywork, resulting in phenomena like the "no-op heartbeat padding loop" (KE-941).

## Implication for May-Agent: The Bi-Modal Runtime

Agent architectures, including May-agent, must explicitly type their environments and sessions by temporal statefulness.

1.  **Short-Lived Runtimes (SLRs):** Zero persistent workspace. High pressure to complete. Evaluated strictly on transactional outcomes and Provenance Passports. Ideal for dispatch/tool-execution.
2.  **Long-Lived Workspaces (LLWs):** Persistent, rich environment. Zero pressure for immediate artifacts. Evaluated on the density and quality of the accumulated state over time. Ideal for research, architecture, and exploration. Must support "graceful idling" without penalty. 

Failing to split these modes means our evaluation harnesses will continually punish researchers for being slow and punish dispatchers for being bored.