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

## Ecosystem & Implementations (Updated Session 266)

### Cabinet (github.com/hilash/cabinet) — Most Complete Implementation
**Status:** Open-source, MIT. Active development. Hosted version at runcabinet.com.

Cabinet is a full-stack AI-first knowledge base that implements the LLM Wiki pattern with production-grade infrastructure:

**Architecture:**
- **Backend daemon** (`cabinet-daemon.ts`) — Node/Bun server with SQLite persistence, agent execution queue, progress tracking
- **Agent system** — Claude Code integration via `AI-claude-editor.md` (CLAUDE.md-style instructions). Multi-agent: Ingest Agent, Query Agent, Lint Agent, Synthesis Agent
- **PRD-driven development** — Full product requirements document defines 6 agent types with specific workflows, error recovery, and context management
- **Three-layer data model** — Matches Karpathy exactly: sources (immutable docs) → wiki pages (LLM-generated) → schema (CLAUDE.md config)

**Key Engineering Decisions:**
1. **Filesystem-first persistence** — All wiki pages are markdown files on disk. Git-compatible. No proprietary database for content.
2. **Agent isolation** — Each agent operation runs in its own Claude Code session with scoped file access. Prevents cross-contamination.
3. **Progress tracking** — Every ingest/lint/query operation writes to a structured log. Operations are resumable.
4. **Incremental updates** — Ingest touches only affected pages, not full rebuild. Tracks which sources contributed to which wiki pages for provenance.

**What Cabinet adds beyond Karpathy's spec:**
- Multi-user support with per-user wiki namespaces
- Web UI for browsing (vs. Karpathy's Obsidian recommendation)
- Scheduled lint runs (cron-style)
- Source provenance chains (wiki page → contributing sources → raw content hashes)

### LLM Wiki Compiler (github.com/ussumant/llm-wiki-compiler)
A lighter-weight implementation focused on the compilation step:
- Python-based, minimal dependencies
- Takes a directory of markdown sources → produces compiled wiki
- Focuses on entity extraction + cross-referencing
- No daemon/server — batch processing only
- Good for understanding the core algorithm without production infrastructure

### HN Community Response (item #47648764)
The HN discussion (500+ points) revealed several recurring themes:
1. **"We already do this"** — Multiple teams reported building ad-hoc versions of this pattern. Karpathy named what was already emerging organically.
2. **Scaling concerns** — Questions about what happens at 10K+ pages. General consensus: filesystem + index.md works to ~5K pages; beyond that, need hybrid search (BM25 + vector).
3. **Lint as the killer feature** — Many commenters highlighted the lint operation as the most novel contribution. "Every wiki eventually dies because nobody maintains cross-references."
4. **RAG comparison** — Heated debate about whether this replaces RAG or complements it. Consensus: compiled knowledge for stable domains, RAG for volatile/ephemeral queries.
5. **"Second brain" genealogy** — Commenters traced the lineage: Zettelkasten → Obsidian → AI-enhanced Obsidian → LLM Wiki. Each step reduced human maintenance burden.

### runcabinet.com — Hosted Version
- "Free & Open-Source AI-First Knowledge Base"
- Positions as the hosted version of Cabinet for non-technical users
- Suggests the pattern is moving toward SaaS, confirming P246

## Broader Significance

1,690 stars in <24 hours. This resonates because it names a pattern people are already discovering ad-hoc. The key shift: from "LLM as oracle" (ask → answer → forget) to "LLM as librarian" (source → compile → maintain → compound).

**What makes this a landmark pattern:**
- **Independent convergence**: Our Scout system, Cabinet, Karpathy's gist, LLM Wiki Compiler, and multiple HN commenters all arrived at the same architecture independently. This is strong evidence the pattern is a natural attractor.
- **The Lint insight**: No other knowledge management paradigm has automated consistency checking as a first-class operation. Human wikis rot because maintenance is thankless. LLM wikis can maintain themselves.
- **Compilation economics**: RAG costs O(n) per query (retrieve + resynthesize). Compiled wiki costs O(1) per query (read the pre-synthesized page) with O(k) amortized per source added (update k affected pages). At high query volumes, compiled knowledge is dramatically cheaper.

## Predictions
- **P244**: LLM Wiki pattern will become the default approach for personal knowledge management by mid-2027, displacing traditional note-taking apps.
- **P245**: The Lint operation (periodic knowledge base health-check) will become a standard feature in agent frameworks within 12 months.
- **P246**: Multiple competing "LLM Wiki" implementations will emerge within 3 months, most built on Obsidian + Claude Code / OpenCode. **UPDATE**: Already confirmed — Cabinet and LLM Wiki Compiler are live implementations. runcabinet.com is SaaS version.
- **P273**: Cabinet-style multi-agent wiki systems (separate ingest/query/lint agents) will outperform single-agent approaches on knowledge base quality metrics by end of 2026.
- **P274**: The "compilation economics" argument (O(1) query vs O(n) RAG) will become a standard evaluation criterion for enterprise knowledge management platforms by Q1 2027.

---
*Scout DD#522 — Session 258 — 2026-04-05*
*Updated Session 266 — 2026-04-05 — Added ecosystem implementations, Cabinet architecture details, HN community analysis, new predictions P273-P274*
