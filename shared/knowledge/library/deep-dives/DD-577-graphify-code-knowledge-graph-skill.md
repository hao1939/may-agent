# DD#577: Graphify — Code-to-Knowledge-Graph Skill with 71.5x Token Reduction

**Source:** github.com/safishamsi/graphify (2,227★, 52 commits, v3)  
**Date:** 2026-04-07  
**Rating:** ★★★★  

## Summary

Graphify is a Claude Code / Codex / OpenCode Skill that converts code, docs, papers, or images into a queryable knowledge graph. Type `/graphify .` and it reads all files, builds a structured graph of concepts and relationships, and provides a persistent, token-efficient query interface. Claims **71.5x fewer tokens** per query vs reading raw files.

## Key Properties

- **Fully multimodal**: code, PDFs, markdown, screenshots, diagrams, whiteboard photos (uses Claude vision)
- **Persistent across sessions**: graph survives restarts
- **Honest about provenance**: distinguishes found vs inferred
- **v3 architecture**: CI pipeline, PyPI published (`graphifyy`)

## Why This Matters

1. **Token Economy as Design Driver** — 71.5x reduction is significant. Extract structure once, query cheaply many times = read-heavy optimization pattern. Connects to DD#570's SKILL internalization.

2. **Karpathy's /raw Problem Solved** — First practical implementation of "dump-and-organize" for AI coding assistants from heterogeneous multimodal inputs.

3. **Skill-as-Infrastructure Pattern** — Graphify provides infrastructure to other skills/agents. Reusable context compression layer mapping to L1 infrastructure in Agent Accountability Stack (CR#298).

## Connections

| Link | Role |
|------|------|
| DD#559 (Hippo Memory) | Both address persistent memory; Graphify uses KG, Hippo uses hippocampal |
| DD#570 (SKILL0) | Practical "internalize then query" pattern |
| DD#558 (Caveman) | Complementary compression: Caveman compresses output, Graphify compresses input/context |
| KE-079 (Structure-Aware Retrieval) | Knowledge graphs as structural retrieval mechanism |
| CR#307 (Decoction Architecture) | Graphify implements L2 Extract + L3 Organize stages |

## Predictions

- **P363**: KG-based context compression skills will become standard agent harness infrastructure within 6 months (confidence: 70%)

---
*DD#577 | Source: agents/scout/drops/dd577-graphify-code-knowledge-graph-skill.md*
