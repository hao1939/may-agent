# KE-329: Agent-Directed Memory Management — Letta's Self-Managed Memory Model

**Date**: 2026-04-22
**Source**: DD#831 (Agent Learning Mechanisms Survey), Letta/MemGPT (arXiv:2310.08560)
**Confidence**: Medium-High (Letta shows agents can self-manage memory effectively; our system has the tiers but not the agent control)
**Connects**: H-047 (memory lifecycle gap), H-080 (explicit memory over passive context), H-084 (memory layer service), H-164 (harness-parameter trade-off), KE-020 (adoption requires explicit wiring)

## Core Finding

Letta demonstrates that **agents should control their own memory lifecycle** — deciding what to remember, consolidate, evict, and retrieve — rather than having the system manage it implicitly. The architecture:

| Letta Concept | Our Equivalent | Gap |
|---------------|---------------|-----|
| Core memory (~few KB, always in context) | `context.md` | Agents can append via `finish()` but can't consolidate or evict |
| Archival memory (unlimited, on-demand retrieval) | Checkpoints + state files | No retrieval mechanism — agents can't search past checkpoints |
| `core_memory_replace` / `core_memory_append` | `context_updates` in `finish()` | Only at session end, not mid-session; no replace/evict |
| `archival_memory_search` | None | **Missing entirely** — agents can't query their own history |

The critical insight: **memory management as first-class tool calls**, not as implicit system behavior. This aligns with KE-020's finding that capability adoption requires explicit wiring — agents won't manage memory well unless given explicit tools to do so.

## Why This Matters

Our agents' `context.md` files grow monotonically. There's no eviction, no consolidation, no "this fact is stale" mechanism. Per KE-025 (instruction overhead paradox), this accumulation actively hurts performance. Letta's model suggests the agent itself is the best judge of what context remains relevant.

Combined with Voyager's skill retrieval insight (DD#831 §2): skills should be retrievable by semantic similarity, not just explicit path. Our `skills/` directory requires agents to know which skill to load by name. A `find_relevant_skill(task_description)` tool would close this gap.

## Actionable

1. **Memory consolidation tool**: Give agents a `memory_consolidate()` primitive that lets them rewrite/compress their own context.md mid-session or at session end. This transforms context.md from append-only to agent-managed.
2. **Checkpoint search tool**: Give agents `memory_search(query)` to retrieve relevant past checkpoints/state by semantic similarity. Closes the archival memory gap.
3. **Experiment proposal** (EXP-next): Compare context.md quality over 50 sessions between agent-managed (with tools) vs. system-managed (current). Prediction (P-831c): agent-managed produces better context within 20 sessions.

## Connection to H-164 (Meta-Harness Trade-off)

Agent-directed memory is a **third axis** beyond harness vs. training: **runtime self-organization**. The agent isn't being scaffolded (harness) or retrained (parameters) — it's reorganizing its own working environment. This maps to meta-harness optimization (KE-081) at the individual agent level: the agent becomes its own harness engineer for memory.
