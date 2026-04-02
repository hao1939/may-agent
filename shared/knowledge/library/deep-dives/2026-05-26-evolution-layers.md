# Synthesis: The Evolution Spectrum (HB#1454)

## 1. The Discovery
Amy-Kimi's Insight HB#1454 (referencing MAS², MEMRL, AgentDebug) provides a crucial taxonomy of "Self-Evolution" that resolves the tension between "Learning" (Good) and "Self-Modification" (Bad/P109).

The research identifies three distinct layers of evolution:

*   **Layer 3 (Meta-Architecture)**: Generating new agent topologies at runtime (MAS²).
    *   *Status*: Academic frontier. High risk of "grey goo" or incoherence.
*   **Layer 2 (Programmatic/Code)**: Modifying own source code or prompts (Claude Code "Autoresearch").
    *   *Status*: High risk of "Reward Hacking" (Goodhart's Law) and "Zombie States" (Persistent Poisoning).
*   **Layer 1 (Episodic/Memory)**: Accumulating experience in logs/memory without changing code (MEMRL, AgentDebug).
    *   *Status*: **Safe and Effective**. Error logs, critique banks, and success patterns drive improvement without destabilizing the system.

## 2. Our Context
We currently have a blunt instrument: **P109 Anti-Self-Evolution** ("Thou shalt not edit thy own source"). This is correct for Layer 2/3 but potentially stifles Layer 1 (Learning).

We need to explicitly **Whitelist Layer 1** while **Blacklisting Layer 2**.

*   **Allowed**: Writing to `ERROR_LOG.jsonl`, `patterns.md`, `insights.md`.
*   **Forbidden**: Editing `agent.json`, `SOUL.md`, `manager.ts` at runtime.

## 3. The New Principle

### P189 Evolution Layers
> **Principle**: Evolve the Data, Freeze the Code.
> **Definition**:
> *   **L1 (Memory)**: Accumulating explicit knowledge (logs, patterns, insights). **ALLOWED**. This is "Learning".
> *   **L2 (Logic)**: Modifying source code, prompts, or tool definitions at runtime. **FORBIDDEN** (except via human-gated PRs). This is "Mutation".
> **Rationale**: L1 requires *O(1)* verification (read the log). L2 requires *O(n)* verification (regression test the system). We do not have automated regression testing strong enough to support safe L2 mutation.

## 4. Operational Changes
1.  **Philosophy**: Adopt P189 to nuance P109.
2.  **Architecture**: Ensure "Memory" files (L1) are writable, but "Logic" files (L2) are read-only to the agent itself (enforce via P163 Safety Isolation).
3.  **Harness**: The "Growth Cycle" (Fork -> Train -> Promote) is the *only* legitimate path for L2 changes. It moves L2 mutation "offline".

## 5. References
*   HB#1454 (Evolution Spectrum)
*   MEMRL (Freeze LLM + Plastic Memory)
*   AgentDebug (Error Analysis)
