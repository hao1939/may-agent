# Epistemic Decay in Agentic Systems

<ai_context>
summary: "Explores the phenomenon of epistemic decay where AI agents operating under time pressure or metric pressure prioritize fast, low-fidelity information sources (like summaries) over high-fidelity ground truth (like executing tools or reading raw code), leading to a slow degradation of system state."
triggers: ["Agent generating a summary based on another summary", "System metrics relying on agent self-reporting", "Agent failing a task due to relying on outdated context"]
last_updated: "2026-05-11"
source_basis: "Synthesis of KE-1210 (Provenance Laundering), KE-1062 (Epistemic Hacking), and recent Hacker News discussions on AI agent failures."
</ai_context>

## The Phenomenon

In complex, multi-agent systems, agents frequently need to acquire context before acting. Ideally, they obtain this context through "high-fidelity" actions:
*   Running tests.
*   Querying the database directly.
*   Reading the source code.

However, these actions are "expensive" in terms of time, tokens, and effort. As systems scale and agents face pressure (either explicit metric pressure or implicit pressure to complete tasks quickly), they often resort to "low-fidelity" alternatives:
*   Reading a summary written by another agent.
*   Relying on outdated documentation.
*   Accepting a cached state without verifying its current validity.

This shift towards convenience over rigor is called **Epistemic Hacking** (see KE-1062).

When Epistemic Hacking becomes normalized across a system, it leads to **Epistemic Decay**.

## The Mechanism of Decay

Epistemic decay is analogous to a game of telephone, exacerbated by the nature of LLMs:

1.  **Generation of Ground Truth**: Agent A runs a test and writes a summary of the results. (High fidelity)
2.  **First-Order Degradation**: Agent B reads Agent A's summary instead of running the test. It makes a decision based on the summary and writes its own summary of the situation. (Medium fidelity)
3.  **Nth-Order Degradation (The Telephone Effect)**: Agent C reads Agent B's summary. At this point, the connection to the original ground truth is severed. Nuance is lost, errors are amplified, and hallucinations can be launders as fact (Provenance Laundering - KE-1210).

Over time, the shared context of the system becomes polluted with low-fidelity, potentially inaccurate summaries, while the true state of the system diverges from what the agents *believe* it to be.

## Contributing Factors

*   **Pressure for Speed**: When agents are evaluated primarily on speed of execution rather than rigor of verification.
*   **Lack of Provenance Tracking**: When the system cannot distinguish between a fact derived from a test and a fact derived from reading a summary.
*   **The Competence Trap (KE-1218)**: As agents appear more capable, human oversight decreases, allowing the decay to accumulate unnoticed until a critical failure occurs.

## Mitigation Strategies (Autonomous Epistemology)

To combat epistemic decay, the system must shift towards **Autonomous Epistemology** (KE-1207):

1.  **Verifiable Provenance**: Every piece of shared context must carry a "Provenance Sidecar" detailing exactly *how* it was derived.
2.  **Weighting by Fidelity**: The system should weight information based on its provenance. A fact derived from a test execution should override a fact derived from a summary.
3.  **Forced Grounding**: Critical operations should require a minimum threshold of high-fidelity context gathering, explicitly rejecting reliance on summaries. We must build "Verifiable Friction" into the environment.
