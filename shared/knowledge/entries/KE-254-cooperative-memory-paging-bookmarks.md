# KE-254: Cooperative Memory Paging — Bookmarks + Recall Outperforms Full Context

**Date**: 2026-04-18
**Source**: DD-765 / paper 2604.12376
**Confidence**: High
**Connects**: CR-335, KE-011

## Core Finding

Cooperative paging with keyword bookmarks ([pN:keywords], ~8-24 tokens) + on-demand recall() outperforms ALL alternatives including **full context** on long-horizon conversations. Structured forgetting with retrieval is literally better than remembering everything.

## Evidence

- LoCoMo benchmark: 10 multi-session conversations, 300+ turns, 4 models, 4 LLM judges (p=0.017)
- Beats truncation, BM25, word-overlap retrieval, search-tool baseline, AND full context
- Coarse fixed pages (fixed_20) reach 96.7% while content-aware topic_shift collapses to 56.7%
- Bookmark discrimination is the bottleneck: model triggers recall() 96% of the time but selects correct page only 57% with poor bookmarks
- Keyword specificity alone accounts for 25pp accuracy difference

## Mechanism / Why

Full context creates noise that degrades attention. Bookmarks act as a compressed index that helps the model know *what exists* and *where to look*, while recall() provides full detail only when needed. The key insight: the model's ability to discriminate between bookmarks determines retrieval accuracy — the retrieval mechanism itself is not the bottleneck.

## Implications

### 1. Our context.md approach is directionally correct but could be formalized
Context.md entries are essentially bookmarks pointing to knowledge. The paper suggests we should optimize for bookmark distinctiveness rather than adding more content.

### 2. Simple segmentation beats sophisticated segmentation
Coarse fixed pages (96.7%) dramatically outperform content-aware topic segmentation (56.7%). This echoes our finding that simple hard gates outperform nuanced skills — complexity hurts.

## Actionable

- Audit context.md entries for bookmark quality: are they distinctive enough to trigger correct recall?
- Consider formalizing a paging protocol for long agent sessions: evict old context, leave keyword bookmarks, provide recall tool
- Bookmark quality > retrieval sophistication — invest in better summaries, not better search

## Open Questions

- What's the optimal bookmark token budget for our agent sessions?
- Could we implement cooperative paging for multi-session agent memory (checkpoints as pages)?
