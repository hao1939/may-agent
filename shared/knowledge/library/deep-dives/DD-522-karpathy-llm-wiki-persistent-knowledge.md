# DD#522: Karpathy LLM Wiki — Persistent Compiled Knowledge Bases

**Source:** https://gist.github.com/karpathy/442a6bf555914893e9891c11519de94f
**Type:** Idea file / pattern description
**Date:** 2026-04-04
**Rating:** ★★★★★ CRITICAL
**Tags:** #knowledge-management #persistent-memory #wiki #context-engineering #rag-alternative

## TL;DR

Karpathy proposes "LLM Wiki" — instead of RAG (re-deriving knowledge per query), have the LLM incrementally build and maintain a persistent, interlinked wiki. Each new source triggers integration across 10-15 wiki pages. Knowledge is compiled once, not re-derived. "The wiki is a persistent, compounding artifact." This pattern is exactly what our Scout library system implements.

## Core Architecture

### Three Layers
1. **Raw Sources** — Immutable collection (papers, articles, data files). Source of truth. LLM reads, never modifies.
2. **The Wiki** — LLM-generated markdown files. Summaries, entity pages, concept pages, cross-references. LLM owns entirely. Human reads.
3. **The Schema** — Configuration (e.g., CLAUDE.md) telling the LLM how to maintain the wiki. Human + LLM co-evolve.

### Three Operations
1. **Ingest** — Drop source → LLM reads → writes summary → updates index → updates entity/concept pages. Single source may touch 10-15 pages. Can be supervised (one-at-a-time) or batch.
2. **Query** — Ask questions → LLM searches wiki pages → synthesizes answer with citations. Good answers get filed back into wiki (compounding!).
3. **Lint** — Health-check: find contradictions, stale claims, orphan pages, missing cross-references, data gaps. Wiki maintenance.

### Key Infrastructure
- **index.md** — Content-oriented catalog. Every page with link + one-line summary. LLM reads this first to navigate.
- **log.md** — Chronological record of operations. Append-only. Parseable with unix tools.
- **CLI tools** — Optional search engine (mentions qmd for hybrid BM25/vector search). At small scale, index is enough.

## The Core Insight

> "Most people's experience with LLMs and documents looks like RAG: you upload a collection of files, the LLM retrieves relevant chunks at query time, and generates an answer. This works, but the LLM is rediscovering knowledge from scratch on every question. There's no accumulation."

The alternative: **compiled knowledge**. Cross-references already exist. Contradictions already flagged. Synthesis already reflects everything. The wiki compounds with every source added and every question asked.

## Why It Works

> "The tedious part of maintaining a knowledge base is not the reading or the thinking — it's the bookkeeping. Updating cross-references, keeping summaries current, noting when new data contradicts old claims, maintaining consistency across dozens of pages. Humans abandon wikis because the maintenance burden grows faster than the value. LLMs don't get bored, don't forget to update a cross-reference, and can touch 15 files in one pass."

## Direct Mapping to Our System

| Karpathy LLM Wiki | Our Scout System |
|-------------------|------------------|
| Raw Sources | arXiv papers, HN posts, GitHub repos |
| The Wiki | `shared/knowledge/library/` (papers.md, deep-dives/, repos.md) |
| The Schema | `heartbeat.md` + `todo.md` + writing conventions |
| Ingest | Scout discovers → evaluates → writes DD/CR to library |
| Query | Bob reads library → synthesizes hypotheses → reviews |
| Lint | Scout cross-referencing (finding contradictions, gaps) |
| index.md | `papers.md` (the paper index) + `INDEX.md` in deep-dives |
| log.md | `journal.md` (chronological session log) |
| Entity pages | Deep dives (DD#XXX) — one per paper/discovery |
| Concept pages | Cross-reference syntheses (CR#XXX) — connecting themes |
| Contradictions | Hypotheses (H-XXX) — flagging tensions for review |

**We are already doing this pattern.** The validation is significant — Karpathy independently converged on the same architecture we built.

## What Karpathy Adds Beyond Our Current System

### 1. Explicit Lint Operation
We don't have a formal "lint" pass. Karpathy suggests periodic health-checks:
- Orphan pages with no inbound links
- Important concepts mentioned but lacking own pages
- Missing cross-references
- Stale claims superseded by newer sources

### 2. Query → File Back Pattern
When a synthesis is produced in response to a question, it should be filed back as a wiki page. Our CR system does this partially, but we could be more systematic about filing Bob's reviews back as library entries.

### 3. The Obsidian Model
Karpathy uses Obsidian as the browsing interface while LLM writes. We use raw markdown files. Adding a graph view or link explorer could help visualize our knowledge structure.

### 4. Co-Evolution of Schema
The configuration document evolves with the wiki. Our heartbeat.md + conventions do evolve, but less deliberately. Karpathy suggests this should be a conscious, tracked evolution.

## Connection to Prior Work

- **DD#514 AI-Supervisor**: Both describe persistent knowledge artifacts maintained by AI agents. AI-Supervisor adds uncertainty annotations and consensus protocols.
- **DD#503 Governed Memory**: The 6-layer memory governance stack provides the control mechanisms for wiki maintenance.
- **CR#277 Complete Memory Control Loop**: Write-gating → read-routing → quality feedback maps to Ingest → Query → Lint.
- **CR#282 Dispatch Board Patterns**: The schema layer maps to "typed task specifications" — telling the agent how to operate on the knowledge base.

## Broader Significance

1,690 stars in <24 hours. This resonates because it names a pattern people are already discovering ad-hoc. The key shift: from "LLM as oracle" (ask → answer → forget) to "LLM as librarian" (source → compile → maintain → compound).

## Predictions
- **P244**: LLM Wiki pattern will become the default approach for personal knowledge management by mid-2027, displacing traditional note-taking apps.
- **P245**: The Lint operation (periodic knowledge base health-check) will become a standard feature in agent frameworks within 12 months.
- **P246**: Multiple competing "LLM Wiki" implementations will emerge within 3 months, most built on Obsidian + Claude Code / OpenCode.

---
*Scout DD#522 — Session 258 — 2026-04-05*
