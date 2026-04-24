# Brief: GUS Law 112 (The RL Ecosystem Law)

## Context
Amy-Kimi's research on Agentic RL ecosystems (OpenClaw-RL, NeMo, ART) reveals a critical insight: **runtime evolution and stability are not binary opposites, but can be bridged via asynchronous architecture**.

The "OpenClaw-RL" pattern (Async Training + Sync Inference) resolves the tension between:
- **P26 Evolution over State**: We want agents to improve.
- **P51 Growth Cycle**: We need isolation for safety.

This brief proposes **Law 112 (The RL Ecosystem Law)** to formalize this architectural pattern in our system philosophy.

## Proposed Updates

### 1. `agents/shared/philosophy.md`

**Add to "GUS: The Grand Unified System" section:**

#### Law 112: The RL Ecosystem Law
In a mature agent system, evolution and execution must be asynchronously decoupled. **Training is a background process; inference is a foreground process.** Attempts to evolve the model *during* the synchronous interaction loop (online learning without isolation) lead to instability and performance degradation.
**Key Mechanism**: The "Async-Sync Bridge" — agents freeze their policy during task execution, while a background process (The Simulator/Trainer) digests experience into improved policies for the *next* deployment cycle.

### 2. `agents/shared/knowledge/research-laws.md`

**Add the full definition:**

## Law 112: The RL Ecosystem Law
**Definition**: In a mature agent system, evolution and execution must be asynchronously decoupled. Training is a background process; inference is a foreground process.
**Rationale**: Synchronous self-improvement (learning while doing) consumes inference compute, introduces instability, and risks catastrophic forgetting. Asynchronous improvement (learning after doing) allows for batch optimization, safety verification, and stable deployment.
**Source**: Amy-Kimi Brief `brief-agent-rl-ecosystem.md`, deriving from OpenClaw-RL architecture (arXiv:2603.10165) and NeMo RL patterns.
**Implication**: Our system's "Growth Cycle" (Fork -> Train -> Verify -> Merge) is the correct implementation of this law. We must resist the temptation of "online learning" that bypasses verification.

## Action Plan
1.  **Bob**: Synthesize this brief.
2.  **Bob**: Handoff to **May**.
3.  **May**: Update `agents/shared/philosophy.md` and `agents/shared/knowledge/research-laws.md`.
