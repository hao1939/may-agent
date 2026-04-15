# Knowledge Compilation System

**Status**: Design → Ready for Implementation  
**Inspired by**: [Karpathy's LLM Knowledge Bases](../../../agents/shared/knowledge/library/posts/TWEET-karpathy-llm-knowledge-bases-20260402.md)  
**Date**: 2026-04-04

## Problem

We have 2,575 posts (13MB) in our knowledge library, but:
1. **No compilation** — posts are isolated islands, never consolidated into a navigable whole
2. **No cross-links** — posts don't reference related posts; knowledge is flat, not a graph
3. **No linting** — research digest has obvious duplicates (same papers 2-5x), no health checks
4. **Queries don't compound** — agent research answers vanish into session logs, not filed back
5. **No topic index** — finding "everything we know about multi-agent coordination" requires reading 50+ files

## Design

### Phase 1: Lint & Dedup (Amy-Kimi)

**Owner**: Amy-Kimi  
**Goal**: Clean up the existing knowledge base

1. **Dedup research-digest.md** — identify duplicate entries (same arXiv ID, same topic from different dates), keep the best version, remove others
2. **Dedup posts/** — find posts covering the same paper/topic, merge into canonical versions, redirect or remove duplicates
3. **Standardize naming** — posts have inconsistent naming (HB-XXXX, HB-250408, xhs_*, numbered, etc.). Establish and apply consistent convention
4. **Add metadata** — ensure each post has: date, source, category tags, related posts (backlinks)

**Deliverable**: Clean research-digest.md with ~100 unique entries (down from 168 with dupes), consistent post naming

### Phase 2: Topic Index & Cross-Links (Bob)

**Owner**: Bob (Architect — pattern synthesis)  
**Goal**: Build a navigable topic graph over the knowledge base

1. **Identify major themes** — scan all posts, cluster into 8-12 major topics:
   - Multi-agent architecture & coordination
   - Memory & knowledge management  
   - Self-evolution & learning
   - Harness engineering & safety
   - Evaluation & benchmarking
   - Tool/skill ecosystems
   - RL for agents
   - Human-agent interaction
   - (discover others from the data)

2. **Create topic index files** — for each theme, write `agents/shared/knowledge/library/topics/TOPIC-NAME.md` containing:
   - Overview paragraph (what we know about this topic)
   - Curated list of relevant posts with one-line summaries
   - Key findings/principles extracted
   - Open questions / gaps
   - Cross-references to related topics

3. **Write a master index** — `agents/shared/knowledge/library/INDEX.md` that links all topics, provides a bird's-eye view

**Deliverable**: Topic directory with 8-12 navigable topic files, master INDEX

### Phase 3: Compilation Workflow (Tech-Lead)

**Owner**: Tech-Lead  
**Goal**: Build a repeatable "compile" process that keeps the knowledge base healthy

1. **Knowledge compilation handler** — a periodic task (like a cron handler or heartbeat step) that:
   - Scans for new posts since last compilation
   - Assigns them to topic index files (updates cross-references)
   - Flags potential duplicates
   - Suggests synthesis opportunities (3+ posts on same subtopic → candidate for synthesis doc)

2. **Query-result filing** — when any agent produces a research answer, it should be filed as a post:
   - Add a convention: research-quality answers → save to `library/posts/QUERY-YYYY-MM-DD-topic.md`
   - Update the topic index

3. **Health check script** — a simple lint that checks:
   - Duplicate detection (same arXiv IDs, same titles)
   - Orphan posts (not referenced in any index/digest)
   - Broken links
   - Posts missing required metadata (date, category)

**Deliverable**: Compilation workflow, health check script, query-filing convention

## Implementation Order

```
Phase 1 (Amy-Kimi) ──→ Phase 2 (Bob) ──→ Phase 3 (Tech-Lead)
   Clean up first      Build the graph     Automate maintenance
   ~1-2 sessions       ~1-2 sessions       ~1-2 sessions
```

Phase 1 must come first — no point building an index over dirty data.
Phase 2 and 3 can partially overlap.

## Success Criteria

- [ ] Research digest has zero duplicates
- [ ] Every post has category tags and date
- [ ] 8-12 topic index files exist, each linking relevant posts
- [ ] Master INDEX.md provides full navigation
- [ ] Health check script catches future duplicates
- [ ] New posts automatically get indexed into topics

## Non-Goals

- Fancy vector DB or RAG — markdown + index files is the Karpathy-validated approach
- Renaming all 2,575 posts — just establish convention for new ones, fix worst offenders
- Real-time search — periodic compilation is fine
