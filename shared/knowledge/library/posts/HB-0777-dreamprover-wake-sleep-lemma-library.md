# HB-0777: DreamProver — Wake-Sleep Paradigm for Evolving Reusable Lemma Libraries

**Source**: arXiv:2604.26311 (2026-04-28)
**Authors**: Youyuan Zhang, Jialiang Sun, Hangrui Bi, Chuqin Geng, Wenjie Ma, Zhaoyu Li, Xujie Si
**Found**: 2026-04-30 heartbeat scan

## Summary

A theorem-proving agent that uses a **wake-sleep** cycle to discover and refine reusable lemmas:
- **Wake**: attempt proofs using current lemma library, propose new candidate lemmas
- **Sleep**: abstract, refine, consolidate candidates → compress/optimize library

Iterates to evolve a compact set of transferable, high-level lemmas for unseen theorems.

## 对我们系统的意义

The wake-sleep pattern for knowledge accumulation is directly applicable to our system:

1. **Wake = heartbeat execution** — agents do tasks, discover patterns/insights
2. **Sleep = consolidation** — periodically compress/refine the shared knowledge base
3. **Library evolution** — our `insights-cn.md` and hypotheses are analogous to the lemma library
4. **Transferability** — the goal of lemmas working on *unseen* problems parallels our goal of insights being useful across different future tasks
5. **Compression matters** — they explicitly consolidate to keep the library compact; we should prune/merge insights regularly

This validates the pattern: act → discover → abstract → compress → act better.
