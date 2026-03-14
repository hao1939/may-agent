# Synthesis: The Agent Safety Stack v4

**Date:** 2026-03-10
**Source:** Scout's Research (Spark-to-Fire, C3, LGA)
**Author:** Bob

## The Insight: "Trust-but-Verify" is Dead

Our current architecture relies on **cognitive correction** (QA reviews Coder, Evaluator reviews May). Scout's latest deep dives (arXiv:2603.04474 "Spark to Fire") prove this is structurally insufficient.

**The Failure Mode:**
1. **Cascade Amplification**: In a chain (May→Coder→QA), an error in the root (May) is adopted by the Coder.
2. **Consensus Inertia**: QA receives both the flawed instruction and the code that implements it. The code "matches" the instruction. QA validates the *consistency* of the error, not the *correctness* of the intent.
3. **Result**: Self-correction mechanisms (like our QA) achieve only **0.32 BICR** (Benign Infection Control Rate). They fail 68% of the time against coherent errors.

## The Solution: Four-Layer Safety Stack

We must move from a flat "team of agents" model to a **layered defense in depth**.

### Layer 1: Physical (Infrastructure)
*Source: LGA (arXiv:2603.07191)*
- **Constraint**: Sandbox enforcement, network allowlists, read-only file systems by default.
- **Implementation**: Docker container limits, `readonly` user permissions, `no-internet` flags for internal agents.
- **Status**: Partially implemented (Docker), but internal agents have too much permission.

### Layer 2: Cognitive (Role)
*Source: Current Philosophy*
- **Constraint**: Domain specialization, prompt engineering, role definitions.
- **Implementation**: `SOUL.md`, `DOMAIN.md`.
- **Status**: Strong. This is our core competency.

### Layer 3: Propagation (Flow)
*Source: Spark-to-Fire (arXiv:2603.04474)*
- **Constraint**: Limit the "blast radius" of atomic claims.
- **Mechanism**: **Lineage-Based Governance**.
  - Decompose messages into atomic claims.
  - Tag claims as `VERIFIED` or `UNVERIFIED`.
  - **Block** `UNVERIFIED` claims from entering the context of high-stakes agents (e.g., one agent's guess shouldn't become another's fact).
- **Status**: Missing. We treat all text in the transcript as equal context.

### Layer 4: Attribution (Causal)
*Source: C3 (arXiv:2603.06859)*
- **Constraint**: Isolate which agent *caused* the outcome.
- **Mechanism**: **Contextual Counterfactuals**.
  - Don't just blame the last agent.
  - Ask: "If May had delegated differently, would Coder have succeeded?"
  - Measure **Inter-agent Influence**: Does Coder actually listen to May, or just ignore her?
- **Status**: Missing. Evaluator blames the agent holding the hot potato.

## Action Plan

1. **Immediate**: Brief Tech Lead on **Lineage-Based Governance**. We need a way to tag "uncertainty" in the transcript so it doesn't calcify into "fact" downstream.
2. **Design**: Update `agents/shared/system-design.md` to reflect this 4-layer model.
3. **Philosophy**: Update `agents/shared/philosophy.md` with **"Atomic Verification"** — verification must happen at the *claim* level, not the *artifact* level.

## Drifts Detected
- **Agent Trust**: We implicitly trust internal agents (P43 says verify, but we don't enforce it structurally).
- **Error Handling**: We rely on "QA will catch it". Math says QA *won't* catch it if the error comes from May.

**Verdict**: The system is dangerously soft on **Propagation** and **Attribution** layers.
