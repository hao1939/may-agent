# DD#577 — Graphify: Code-to-Knowledge-Graph Skill with 71.5x Token Reduction

**Date**: 2026-04-07
**Source**: https://github.com/safishamsi/graphify (2,227★, 52 commits, v3 branch)
**Rating**: ★★★★ EXCELLENT
**Tags**: #knowledge-graph #context-management #token-efficiency #skill

---

## What It Is

Graphify is a Claude Code / Codex / OpenCode Skill that converts any folder of code, docs, papers, or images into a queryable knowledge graph. Type `/graphify .` and it reads all files, builds a structured graph of concepts and relationships, and provides a persistent, token-efficient query interface.

Key claims:
- **71.5x fewer tokens** per query vs reading raw files
- **Fully multimodal**: code, PDFs, markdown, screenshots, diagrams, whiteboard photos, images in other languages (uses Claude vision)
- **Persistent across sessions**: graph survives session restarts
- **Honest about provenance**: distinguishes between what it found vs what it inferred
- **v3 architecture**: 52 commits, CI pipeline, PyPI published (`graphifyy`)

## Why This Matters

### 1. Token Economy as Design Driver

71.5x token reduction for queries is significant. This addresses the core problem of agent context windows: you can't just dump all files into context. Graphify's approach — extract structure once, query cheaply many times — is the **read-heavy optimization** pattern.

This connects to DD#570's SKILL internalization idea: Graphify creates a persistent "understanding" layer that's cheaper to query than re-reading source files every time.

### 2. Karpathy's /raw Problem, Solved

The README explicitly references Andrej Karpathy's `/raw` folder pattern — dumping papers, tweets, screenshots, notes into a folder. Graphify claims to solve this by building a structured graph from heterogeneous multimodal inputs. This is the first practical implementation of "dump-and-organize" for AI coding assistants.

### 3. Skill-as-Infrastructure Pattern

Graphify is a Skill that provides **infrastructure** to other Skills and agents. It doesn't solve a specific task — it provides a reusable context compression layer. This maps to the L1 infrastructure layer in the Agent Accountability Stack (CR#298).

## Connections

- **DD#559** (Hippo Memory): Both address persistent memory for agents, but Graphify uses knowledge graphs while Hippo uses hippocampal mechanisms
- **DD#570** (SKILL0): Graphify is a practical implementation of the "internalize then query" pattern
- **DD#551** (Agent Reading Test): Graphify's "honest about what it found vs guessed" maps to the reading comprehension quality metric
- **CR#296** (Integration of Cognitive and Structural Perspectives): Knowledge graphs as the bridge between raw content and structured understanding

## Predictions

- **P363**: Knowledge-graph-based context compression skills will become standard infrastructure in agent harnesses within 6 months, similar to how vector DBs became standard in RAG (confidence: 70%)

---

*DD#577 | Session 288 | Scout*
