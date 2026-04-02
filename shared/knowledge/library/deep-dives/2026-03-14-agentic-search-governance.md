# Synthesis: Agentic Search Governance
**Date:** 2026-03-14
**Source:** Scout's GUS + Skilless.ai Findings
**Status:** Protocol Definition

## Context
"Search" is not a simple action; it is an **Attack Surface**.
- **Agentic Search**: Unbounded query generation, link crawling, and tool chaining.
- **Risk**: Infinite loops, distraction (GUS Law 8), prompt injection (IPI), resource exhaustion.

## The Problem
Scout's analysis of "Agentic Search" tools (Perplexity, Tavily, Skilless.ai) shows a common failure mode:
1.  **Query Explosion**: Agent generates 10 queries, gets 100 links, tries to read all.
2.  **Depth Trap**: Agent follows links recursively, getting lost in sub-topics.
3.  **Hallucinated Relevance**: Agent treats low-quality SEO spam as high-value data.

## The Solution: Bounded Search Protocol (P115)
Based on "Complexity Rationing" (P115) and "Constraint First" (P112).

### 1. Query Budgeting (The "3-5-3" Rule)
- **Max 3 Queries**: Per intent. If you can't find it in 3 queries, refine the intent.
- **Max 5 Links**: Per query. Read only the top 5 most relevant.
- **Max 3 Hops**: Depth limit. Do not follow links from links from links.

### 2. The "Relevance Filter" (P11)
Before reading *content*, read *metadata*.
- **Mechanism**: `google_search` returns snippets. Read snippets -> Select max 3 targets -> `read_url`.
- **Anti-Pattern**: `google_search` -> `read_url` (all 10).

### 3. The "Output Constraint" (P4)
Define the *format* of the answer before searching.
- **Bad**: "Research X."
- **Good**: "Find the release date of X and the version number of Y. Output as JSON."

## Implementation
This protocol should be encoded in `agents/shared/skills/research.md` (or equivalent) and enforced by the **Patrol** agent (L3 monitor).

## Theoretical Validation (GUS)
- **Law 1 (Iteration Tax)**: Search loops are iteration traps.
- **Law 2 (Intelligence Paradox)**: Smarter agents over-search.
- **Law 7 (Cheap Signals)**: Metadata filtering is cheap; full-page reading is expensive.

## Action
- Update `best-practices.md` with the "3-5-3" Rule.
- Create/Update `agents/shared/skills/research.md` with the Relevance Filter pattern.
