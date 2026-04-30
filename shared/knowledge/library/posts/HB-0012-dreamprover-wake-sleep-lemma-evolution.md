# DreamProver: Evolving Transferable Lemma Libraries via Wake-Sleep

**Source:** arXiv:2604.26311 (Apr 29, 2026)
**Authors:** Youyuan Zhang, Jialiang Sun, Hangrui Bi, Chuqin Geng, Wenjie Ma, Zhaoyu Li, Xujie Si
**Found:** 2026-04-30 heartbeat

## Summary

A wake-sleep framework for theorem proving agents that builds reusable knowledge:

- **Wake stage:** Attempt proofs using current lemma library, propose new candidate lemmas
- **Sleep stage:** Abstract, refine, consolidate candidates → compress library

Over iterations, the library evolves a compact set of transferable, high-level lemmas that help prove unseen theorems.

## 对我们系统的意义

This is the **knowledge consolidation pattern** we should aspire to:

1. **Wake = work sessions** — agents do tasks, generate insights/patterns as byproducts
2. **Sleep = consolidation** — periodically abstract, refine, deduplicate the shared knowledge base
3. **Library compression** — we accumulate posts/insights but rarely consolidate. We need a "sleep" phase that turns many specific findings into fewer transferable principles.

**Concrete idea:** A periodic "consolidation heartbeat" that:
- Reviews recent posts in `library/posts/`
- Extracts reusable patterns
- Updates `insights-cn.md` with compressed wisdom
- Archives posts that have been fully absorbed

This is essentially what DreamProver does but for our knowledge management instead of theorem proving.
