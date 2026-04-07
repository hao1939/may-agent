# DD#612 — Hippo: Biologically-Inspired Memory for AI Agents

**Rating:** ★★★★½ (LANDMARK for our memory architecture work)
**Source:** [github.com/kitfunso/hippo-memory](https://github.com/kitfunso/hippo-memory) | [HN thread](https://news.ycombinator.com/item?id=47667672) (82 points, 16 comments)
**Date:** 2026-04-07
**Tags:** #memory #agent-infrastructure #tool #open-source

## Core Idea

Hippo is a zero-dependency, SQLite-backed memory system for AI agents that implements biological memory principles: **decay, retrieval strengthening, and consolidation**. Instead of "save everything and search later" (filing cabinet), it models memory like a brain — things you don't use fade; things you retrieve get stronger; information consolidates across sessions.

## Key Architecture

- **Storage**: SQLite backbone + markdown/YAML mirrors. Git-trackable and human-readable.
- **Cross-tool**: Works with Claude Code, Codex, Cursor, OpenClaw, any CLI agent. Imports from ChatGPT (memory export), Claude (CLAUDE.md), Cursor (.cursorrules).
- **Zero runtime deps**: Node.js 22.5+. Optional embeddings via `@xenova/transformers`.
- **CLI interface**: `hippo remember`, `hippo recall --budget 2000`, `hippo sleep`
- **Budget-aware recall**: Token-budget-aware retrieval — you specify how many tokens you can afford, and it returns the most relevant memories within that budget.
- **Auto-sleep on session exit**: Hooks into Claude Code's Stop hook for automatic consolidation.
- **v0.9.1**: Latest version adds auto-sleep, improved decay curves.

## Biological Memory Principles

1. **Decay**: Memories lose salience over time unless reinforced (Ebbinghaus forgetting curve)
2. **Retrieval strengthening**: Each recall boosts a memory's persistence (testing effect)
3. **Consolidation**: On `hippo sleep`, working memories get consolidated into long-term storage with pattern extraction
4. **Confidence levels**: Memories carry confidence scores that decay/strengthen
5. **Tag-based organization**: Error memories, preference memories, procedural memories

## Why This Matters

### Direct relevance to our memory architecture

This is the most production-ready implementation of the biological memory principles we've been tracking since DD#559 (original Hippo concept), DD#567 (M-Flow), DD#590 (LLMA-Mem), DD#604 (SuperLocalMemory). Key differences from our tracked approaches:

| Aspect | SuperLocalMemory (DD#604) | Hippo v0.9.1 |
|--------|--------------------------|---------------|
| Channels | 7 cognitive channels | 3 (short/long/procedural) |
| LLM calls | Zero | Zero (with optional embeddings) |
| Latency | 14ms retrieval | Not benchmarked (SQLite, likely similar) |
| Cross-tool | No | Yes — imports from Claude/ChatGPT/Cursor |
| Consolidation | Rule-based | Sleep-triggered |
| Token budgets | No | Yes — budget-aware recall |

### The "portable memory" insight

Hippo's killer feature is **memory portability across tools**. This is a problem we face directly — our agents' memory is currently locked into our repo structure. The import/export approach (markdown + SQLite + YAML mirrors) is a pattern worth studying.

### Budget-aware retrieval

The `--budget 2000` flag for recall is exactly the right interface for context-limited agents. This aligns with CR#307 (Decoction Architecture) — the injection stage needs to be budget-aware.

## Connection to Our Research

- **DD#559** (Hippo concept): Early version — this is now v0.9.1, significantly matured
- **DD#604** (SuperLocalMemory): Complementary approach, more channels but no cross-tool
- **CR#305** (Memory-Intelligence Convergence): Hippo validates the thesis that memory architecture is a scaling axis
- **CR#307** (Decoction Architecture): Hippo's `sleep` consolidation IS decoction
- **DD#590** (LLMA-Mem): Memory topology as scaling axis — Hippo is the practical implementation

## Assessment

Hippo is the strongest open-source candidate for the "practical agent memory layer" slot. Its biological principles align with our theoretical work, and its cross-tool portability solves a real problem. The budget-aware recall is the right interface design. Worth monitoring for integration ideas.

**Key limitation**: No multi-agent memory sharing. Each agent instance has its own Hippo. For our use case (Scout/Bob/Eve), we'd need a shared layer on top.
