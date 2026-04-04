# Karpathy-Inspired Knowledge Compilation Plan

**Created**: 2026-04-04 by May (from Hao's design direction)
**Status**: IN PROGRESS

## Context

Hao outlined 5 gaps between our current KB and Karpathy's knowledge wiki approach. Here's what we already have, what's missing, and who's doing what.

## Current State (already ~60% there)

| Karpathy Element | Our Equivalent | Status |
|-----------------|----------------|--------|
| Raw sources → raw/ folder | Amy-Kimi posts (2,580 files) | ✅ Done |
| Structured wiki with cross-links | Topic indexes (10 pages by Bob) | ✅ Partial |
| Summaries | Deep dives (500+ by Scout) | ✅ Done |
| Categories | Topic INDEX.md with 10 categories | ✅ Done |
| LLM-maintained content | All agent-written | ✅ Done |

## The 5 Gaps (from Hao)

### Gap 1: No Compilation Step — ASSIGNED TO AMY-KIMI
Posts are isolated islands. Need periodic merging of related posts into synthesis articles.

**Implementation**: Amy-Kimi creates synthesis docs that merge 5-10 related posts into one coherent overview per topic. Target: 1 synthesis per topic index category.

**Already started**: DEDUP-PHASE1-REPORT.md shows Phase 1 dedup complete. Phase 2 = compilation.

### Gap 2: No Cross-Links or Backlinks — ASSIGNED TO SCOUT
Posts don't reference each other. Need "See also: [related-post]" links.

**Implementation**: When Scout writes new deep dives or cross-refs, include backlinks to source posts. Add a "Related Posts" section to new deep dives. Bob's topic indexes already provide some of this.

**Quick win**: Add a "Sources" section to each topic index page linking to the specific posts it draws from.

### Gap 3: No Linting — ASSIGNED TO OPTIMIZER
Research digest has duplicates. Need periodic health checks.

**Implementation**: Optimizer runs a periodic audit:
- Dedup posts with >80% content overlap
- Find inconsistencies between posts and synthesis docs
- Suggest missing connections between topics
- Report stale/outdated content

### Gap 4: Queries Don't Compound — ✅ COMPLETE (Bob, 2026-04-04)
Research answers vanish into session logs. Need to file answers back into the wiki.

**Implementation**: Query Compounding Convention designed. See `knowledge/synthesis/CONVENTION-query-compounding.md`. Decision tree: experiments → KE entries, hypotheses → H-XXX, research questions → WKWA or `library/deep-dives/query-*.md`, cross-refs → `library/deep-dives/cross-ref-*.md`. Promotion path: query files → WKWA synthesis when referenced 3+ times.

### Gap 5: No Consolidation/Synthesis — ✅ PILOT COMPLETE (Bob, 2026-04-04)
2,580 posts but synthesis docs are sparse.

**Implementation**: 
- Amy-Kimi: compile posts into per-topic synthesis (Gap 1)
- Scout: cross-ref deep dives already doing this (276 cross-refs exist)
- Bob: topic indexes already provide navigation (10 topics)
- **Pilot "What We Know About" docs created**:
  - `synthesis/WKWA-001-behavioral-intervention.md` — 24 experiments distilled into intervention hierarchy + decision guide
  - `synthesis/WKWA-002-decision-topology.md` — practical R-estimation and architecture selection
  - `synthesis/WKWA-003-self-improvement-limits.md` — why self-improvement fails and what works instead
  - Plus SYNTHESIS-001 (Memory Architecture, already existed in `library/synthesis/`)

## Priority Order

1. **Gap 3 (Linting)** — Quick win. Optimizer dedup + health check. Builds on Phase 1.
2. **Gap 1 (Compilation)** — Amy-Kimi creates per-topic synthesis docs. High impact.
3. **Gap 2 (Cross-links)** — Scout adds backlinks to new deep dives. Medium effort.
4. **Gap 5 (Consolidation)** — Bob creates pilot "What We Know About X" docs. 
5. **Gap 4 (Query compounding)** — Bob designs convention. Lowest urgency.

## Success Metrics

- [ ] 0 duplicates in research digest
- [ ] 10 topic synthesis docs (one per topic index page)
- [ ] New deep dives have ≥2 backlinks to source posts
- [x] "What We Know About" docs for top 3 topics (WKWA-001, 002, 003 created 2026-04-04)
- [x] Query results filed back into KB (convention established 2026-04-04)
