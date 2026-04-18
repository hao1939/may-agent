# KE-219: Cooperative paging (bookmarks + recall) outperforms full context — applies to shared knowledge architecture

**Date**: 2026-04-18
**Source**: DD-765
**Confidence**: Medium-High
**Connects**: KE-011, H-170

## Core Finding

DD-765 shows that replacing evicted context with keyword bookmarks ([pN:keywords], 8-24 tokens) plus a recall() tool **outperforms having everything in the context window**. This isn't just cheaper — it's actually more accurate. The bottleneck is bookmark discrimination (57% correct page selection), not the retrieval mechanism itself.

## Evidence

- On LoCoMo benchmark (300+ turns), cooperative paging beats full context across 4 models and 4 judges (p=0.017)
- Coarse fixed pages (fixed_20) reach 96.7% while content-aware topic_shift collapses to 56.7% — simple boundaries dominate
- Keyword specificity alone accounts for 25pp accuracy difference
- Model triggers recall() 96% of the time but picks the right page only 57% when bookmarks aren't distinctive

## Mechanism / Why

Full context creates a needle-in-haystack problem — the model must attend to everything, diluting attention on what matters. Bookmarks act as a **curated index**, letting the model first decide *what* it needs, then retrieve only that. The cooperative aspect (model co-authors bookmarks) ensures the index matches the model's own retrieval patterns.

## Implications

### 1. Our knowledge/ directory IS a paging system — but with poor bookmarks
Our agents share ~200+ knowledge entries. Context.md and auto-matched entries act as "bookmarks" pointing into this library. DD-765 suggests the binding constraint isn't retrieval (agents can read files) but **bookmark quality** — are our titles/summaries distinctive enough for agents to know which entry to pull?

### 2. Less context injection may be better than more
We currently inject relevant knowledge matches into session context. DD-765 implies we might get better results by injecting fewer, more distinctive pointers and letting agents pull on demand. This aligns with KE-011 (knowledge files are passive — agents skip them) but reframes the solution: don't inject more content, inject better bookmarks.

### 3. Simple segmentation beats clever segmentation
The fixed_20 > topic_shift result maps to our experience: simple hard gates outperform nuanced skills (KE-021). For knowledge organization, coarse categories may work better than fine-grained topic clustering.

## Actionable

- Audit knowledge entry titles for distinctiveness — the 25pp effect from keyword specificity means vague titles like "Context management finding" actively harm retrieval
- Consider a bookmark-style index file (one line per KE with distinctive keywords) rather than injecting full entry content into agent context
- When designing context.md sections, optimize for discrimination ("which entry do I need?") not summarization ("what does each entry say?")

## Open Questions

- What's the optimal bookmark density for our ~200-entry knowledge base? DD-765 tested 20-page systems — does the approach scale?
- Could agents co-author their own bookmarks (as in DD-765) rather than using auto-generated summaries?
- How does this interact with the heartbeat context curation pattern (DD-771)?
