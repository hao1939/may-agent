# Synthesis: Agent Minimal Architecture & Memory Lifecycle
**Date:** 2026-03-25
**Sources:** HB#221 (Ralph Loop), HB#222 (Minimal Architecture), HB#223 (ReMe), HB#224 (OpenViking), HB#225 (AutoAgent)

## 1. Mechanism: The "Loop" as the Core Unit of Agency
The community is converging on a radical simplification: **Agent = LLM + Tool + Loop**.
- **Ralph Loop (shing19):** "Correction speed" is the primary metric. The loop isn't just `while(true)`, it's `while(!verified)`.
- **Minimal Architecture (Codex):** Complex frameworks are traps. The loop is the stable harness; the tools change.
- **Our Alignment:** Our `verified-coder` workflow and `growth-cycle` are implementations of this "Loop" pattern. We are correct to avoid heavy frameworks (LangChain/AutoGPT) in favor of simple bash/TS loops.

## 2. Pattern: Memory as an Active Lifecycle (Not Just Storage)
Three independent signals (ReMe, OpenViking, AutoAgent) confirm that "Vector DB is not Memory".
- **Capture → Store → Recall (OpenViking):** The separation of concerns is critical. We have "Capture" (Workspace), but "Store" (Self-Improvement) and "Recall" (Context Selection) are loosely coupled.
- **Elastic Orchestration (AutoAgent):** "Memory Policy" (what to keep, what to forget) is part of intelligence.
- **Gap:** We lack an explicit **"Forgetting Policy"**. Our memory grows monotonically until context limits hit.

## 3. Principle: Structure > Algorithm (P72 Extension)
"Recall quality depends on storage structure, not retrieval algorithm." (Eda).
- Dumping raw logs into vector DBs is a failure mode.
- **Synthesis Protocol** (Bob's new skill) is a structural fix for this — it distills logs into "Mechanism/Pattern/Principle" *before* storage.

## 4. Conclusion & Action
1. **Validate "Loop" Primacy**: Ensure our "Agent Growth Cycle" remains a simple, verifiable loop. Do not over-engineer it into a "framework".
2. **Design Forgetting Policy**: We need a mechanism to prune stale or low-value memories from `agents/shared/memory/`.
3. **Double Down on Synthesis**: The "Synthesis Protocol" is our implementation of the "Capture → Store" transformation. It converts raw experience (logs) into structured knowledge (principles).

## Recommendations
- **No immediate architectural changes needed.** The signals validate our current trajectory (V2 Architecture, Growth Cycle, Synthesis Protocol).
- **Watchlist**: "Forgetting Policy" — when memory size impacts performance/cost, we will need a pruning mechanism.
