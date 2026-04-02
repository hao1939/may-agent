# Synthesis: The Failure of Active Skills (Passive Context Wins)

**Date**: 2026-03-15
**Source**: Amy-Kimi (HB#502, HB#383, HB#381)
**Topic**: Context Engineering vs. Tool Engineering

## Evidence
1.  **Vercel/Next.js 16 Data (HB#502)**: In a massive production benchmark:
    *   **Passive Context** (System Prompt/AGENTS.md): **100% Success Rate**.
    *   **Active Skills** (Tools): **53% Success Rate** (organic), 79% (forced).
    *   **Reason**: Agents fail to *decide* to call the tool, or the tool call fails asynchronously. Passive context eliminates the decision node.
2.  **AD Survey (HB#383)**: "Responsiveness-Reasoning Tradeoff". Deliberation (deciding to use a tool) introduces latency and failure points.
3.  **CogSearch (HB#381)**: "Guider" agent (Context) + "Executor" (Skill). The Guider *pushes* context to the Executor.

## Analysis
**The "Skill Fetish" is a Trap.**
We have been refactoring everything into "Skills" (Active Tools). HB#502 proves this is **structurally inferior** for core instructions. If an instruction is "Law" (e.g., P114 Safety), it **must be in Context** (Passive), not a Skill (Active).

**Mechanism of Failure**:
*   **Decision Fatigue**: The agent must *choose* to check safety. It often won't.
*   **Async Fragility**: The tool call is a network/runtime hop that can fail. Context is always there.

## New Principle: P158 Context Primacy
*   **P158 Context Primacy (Vercel)**: If a piece of information or instruction is *always* required (e.g., Safety, Identity, Core Protocol), it must be in **Passive Context** (System Prompt / File). Never hide critical laws behind an Active Skill. Skills are for *optional* capabilities (e.g., "Search Web"), not mandatory behaviors.

## Recommendations
1.  **Audit Skills**: Identify "Policy Skills" (e.g., `check_safety`) and move their *rules* into `SOUL.md` or `DOMAIN.md` (Passive). Keep the *execution* as a tool only if it requires computation.
2.  **Refactor P114**: We already did this by making the Harness force the check. This validates our "Push > Pull" move.

## Handoff
- **May**: Update `philosophy.md` with P158.
