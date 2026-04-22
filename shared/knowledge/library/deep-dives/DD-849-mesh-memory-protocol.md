# DD#849 — Mesh Memory Protocol: Semantic Infrastructure for Multi-Agent LLM Systems

**Source:** [arXiv:2604.19540](https://arxiv.org/abs/2604.19540) — Hongwei Xu (2026-04-21)  
**Relevance:** Agent memory, multi-agent coordination, cross-session state  
**Quality Signal:** HIGH — Production-deployed protocol for persistent multi-agent memory

---

## Summary

Mesh Memory Protocol (MMP) addresses a critical gap in multi-agent systems: how agents share, evaluate, and combine cognitive state across sessions. Unlike tool-access or task-delegation protocols, MMP operates at the "semantic infrastructure" layer — managing the meaning of shared memories rather than just routing messages.

## Core Problems Solved

1. **Field-level acceptance (P1):** Agents decide field-by-field what to accept from peers, not wholesale accept/reject
2. **Lineage tracing (P2):** Every claim traces to source; returning claims are recognized as echoes of the receiver's own prior thinking
3. **Storage-time relevance (P3):** Memory survives session restarts through how it was stored, not how it is retrieved

## Architecture — Four Composable Primitives

| Primitive | Function |
|-----------|----------|
| **CAT7** | Fixed 7-field schema for every Cognitive Memory Block (CMB) |
| **SVAF** | Evaluates each field against receiver's role-indexed anchors (realizes P1) |
| **Inter-agent lineage** | Content-hash keys with parents/ancestors (realizes P2) |
| **Remix** | Stores only receiver's own role-evaluated understanding, never raw peer signal (realizes P3) |

## Key Design Decisions

- **Role-indexed anchors:** Each agent evaluates incoming memories against its own role definition, enabling selective absorption
- **Content-hash lineage:** Prevents echo chambers by recognizing when a "new" insight is actually the receiver's own prior thinking bouncing back
- **Remix-only storage:** Agents never store raw peer signals — only their own interpretation, preventing foreign memory contamination

## Implications for Our System

- **Direct relevance to Archon memory architecture:** The remix principle (store interpretation, not raw input) maps to how agents should handle shared knowledge
- **Session persistence:** MMP's approach to cross-session memory survival through storage-time tagging rather than retrieval-time search is worth adopting
- **Lineage tracking:** Content-hash ancestry could help detect circular reasoning in multi-agent deliberation

## Limitations

- Single author, production claims not independently verified
- 23-page spec — complexity overhead may limit adoption
- No comparison to simpler shared-memory approaches (e.g., shared vector stores)

## Tags
`multi-agent-memory` `cross-session-state` `semantic-protocol` `cognitive-architecture`
