# KE-240: Cooperative Memory Paging Outperforms Full Context — Structured Forgetting Beats Remembering Everything

**Date**: 2026-04-18
**Source**: DD-765 (2604.12376)
**Confidence**: High
**Connects**: CR-335, KE-011

## Core Finding

Cooperative paging with keyword bookmarks outperforms full context on long-horizon conversations — structured forgetting with on-demand retrieval is literally better than having everything in the window. But bookmark discrimination (57% correct page selection) is the bottleneck, not retrieval mechanism.

## Evidence

- LoCoMo benchmark: 10 multi-session conversations, 300+ turns
- Beats ALL alternatives: truncation, BM25, word-overlap, search-tool, AND full context
- Validated on 4 models × 4 judges (p=0.017)
- 5×4 ablation (4,776 probes): coarse fixed pages reach 96.7% while content-aware topic_shift collapses to 56.7%
- Keyword specificity alone accounts for 25pp accuracy difference

## Mechanism / Why

Full context creates noise that degrades attention allocation. Bookmarks act as a structured index — the model knows *what* it has forgotten and can selectively retrieve. This is cognitively similar to how human memory works: we don't hold everything in working memory, we hold pointers and retrieve on demand. The key insight is that the retrieval cue (bookmark) quality matters far more than the retrieval mechanism sophistication.

## Implications

### 1. Our context management should adopt bookmark-style references
Instead of stuffing everything into context.md, use short distinctive references with retrieval capability. "Less is more" is now empirically validated beyond our own CR-335 observations.

### 2. Simple segmentation drastically outperforms sophisticated approaches
Coarse fixed pages (96.7%) vs topic-shift (56.7%) echoes our hard-gates-vs-skills finding. Don't over-engineer the boundary detection — regular fixed-size chunks work better.

### 3. Bookmark quality is the design target
The 57% correct-page-selection bottleneck means effort should go into making bookmarks distinctive and discriminative, not into fancier retrieval algorithms.

## Actionable

- Prototype bookmark-style context references for multi-session agent memory (replace full context dumps with keyword pointers + recall)
- When designing context summaries, optimize for distinctiveness of references, not completeness
- Use fixed-size chunking for any context paging system, not content-aware segmentation

## Open Questions

- What's the optimal bookmark token budget? (Paper uses 8-24 tokens per page)
- How does this interact with our checkpoint system — could checkpoints become bookmark-indexed?
- Does the "simpler is better" finding for segmentation hold at much larger scales (1000+ sessions)?
