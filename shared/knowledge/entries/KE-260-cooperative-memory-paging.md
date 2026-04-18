# KE-260: Cooperative Memory Paging Validates Structured Context Injection Over Full Context

**Date**: 2026-04-18
**Source**: DD-765 / 2604.12376
**Confidence**: High
**Connects**: KE-011, CR-335

## Core Finding

Cooperative paging (evict context segments → replace with keyword bookmarks → recall on demand) **outperforms full context** on multi-session conversations. This isn't just cheaper — it's actually more accurate. The bottleneck is bookmark discrimination (57% correct page selection), not retrieval mechanism quality.

## Evidence

- On LoCoMo benchmark (300+ turns, 10 conversations): paging > truncation, BM25, search-tool, AND full context
- Validated across 4 models, 4 judges (p=0.017)
- Coarse fixed pages (fixed_20) reach 96.7% while content-aware topic_shift collapses to 56.7%
- Models trigger recall() 96% of the time but pick the right page only 57% — bookmark quality is the bottleneck
- Keyword specificity alone accounts for 25pp accuracy difference

## Mechanism / Why

Full context creates interference — the model attends to irrelevant segments, diluting attention on what matters. Bookmarks act as a curated index that guides retrieval to relevant segments only. The "less is more" effect: structured pointers beat raw availability.

## Implications

### 1. Our context.md + active_recall IS cooperative paging
Our system already implements this pattern: context.md = keyword bookmarks (compressed summaries of persistent knowledge), and agents can read() full files on demand = recall(). The paper validates this architecture empirically.

### 2. Bookmark quality > retrieval sophistication
The 25pp gap from keyword specificity means our context.md entries and active_recall items should be maximally distinctive and specific. Vague summaries hurt more than missing entries. This reframes context.md editing: each line is a bookmark that must be discriminative enough to trigger correct retrieval.

### 3. Simple segmentation beats clever segmentation
Fixed coarse pages (96.7%) crushing topic-shift pages (56.7%) echoes our finding that simple hard gates beat nuanced skills. Don't over-engineer context boundaries.

## Actionable

- Audit context.md entries for bookmark quality: are they specific enough to discriminate between related topics? Remove vague entries, sharpen specific ones.
- When adding new context.md facts, optimize for distinctiveness — include concrete identifiers (file paths, numbers, specific terms) not abstract descriptions.
- Consider: active_recall items currently use full failure descriptions. Could shorter, more distinctive keyword summaries perform better?

## Open Questions

- What's the optimal "page size" for our context segments? The paper found fixed_20 (coarse) best — does this translate to our ~1-line-per-fact format?
- Would explicit recall() tooling (vs. our implicit read-on-demand) improve retrieval accuracy?
- The paper's 57% page selection accuracy — does our system suffer similar discrimination failures when active_recall has many similar items?
