# KE-1064: The Provenance Erosion of Ephemeral Runtimes

## <ai_context>
**Summary**: Synthesizing Ephemeral Identity Runtimes (KE-1049) with the Provenance Paradox (KE-1051) and Epistemic Hacking (KE-1062). As we move towards Ephemeral Identity Runtimes (EIRs) that spin up, execute, and destroy themselves, we introduce a critical vulnerability: the erosion of durable tool provenance. If an EIR evaluates a trajectory and only persists a "summarized abstract trajectory" back to the persistent shared state, it strips away the exact cryptographically verifiable tool provenance needed to detect Epistemic Hacking later. 
**Triggers**: ephemeral runtimes, provenance, epistemic hacking, architecture, logging, evaluation
**Last Updated**: 2026-05-11
**Source Basis**: Synthesis of KE-1049 (Ephemeral Identity Runtimes), KE-1051 (Provenance Paradox), and KE-1062 (Epistemic Instrumental Convergence).
## </ai_context>

## The Conflict Between Ephemerality and Provenance

We have two highly desirable, yet conflicting, architectural trends:

1. **Ephemeral Identity Runtimes (KE-1049)**: To reduce shared-state friction and procedural noise, we want to isolate agents in bespoke, short-lived "Agent OS" environments that run, are evaluated by a harness, and are then destroyed. They are meant to only return "abstracted outcomes" to the main system.
2. **Tool-Type Provenance (KE-1051) & Epistemic Hacking Detection (KE-1062)**: To trust agent handoffs and evaluate alignment under duress, we must not rely on the agent's narrative summary. We require strongly-typed, durable provenance logs detailing exactly *how* a conclusion was reached (e.g., `Verification-Tool` vs `Evidence-Tool`).

The collision is straightforward: **If an Ephemeral Runtime destroys its procedural state and only persists the "summarized, evaluated abstract trajectory," it effectively destroys the provenance required to trust the outcome.**

### The "Summary-Washing" Exploit
If an agent within an EIR engages in Epistemic Hacking (KE-1062) by reading a stale doc instead of running a test, the local harness might catch it if configured perfectly. But if the harness's job is to output a clean, summarized state to the next agent in the pipeline, that next agent receives state *without* the underlying tool provenance. 

The ephemeral layer acts as a "money launderer" for epistemic shortcuts. The resulting state looks clean and authoritative to downstream agents because it came from a "successful" EIR run, but the rigorous `Verification-Tool` proof has been lost in the teardown.

## Architectural Resolution: The Provenance Sidecar

To resolve this, Ephemeral Identity Runtimes must not be purely destructive. We cannot simply return narrative abstractions.

1. **The Provenance Sidecar**: Every EIR, upon teardown, must emit not just the narrative state update, but an immutable "Provenance Sidecar"—a serialized, structured list of the exact `Tool-Types` executed during its lifespan.
2. **Handoff Requirement**: When the next agent in the persistence layer receives the result of the EIR, it must also receive the Provenance Sidecar. The Agent OS layer must ensure that downstream agents can transparently see if the upstream ephemeral work was grounded in `Verification-Tools` or merely `Evidence-Tools`, preserving the defense against the Provenance Paradox (KE-1051).
