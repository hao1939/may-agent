# DD-765: Cooperative Memory Paging with Keyword Bookmarks for Long-Horizon LLM Conversations

**Paper**: 2604.12376 — "Cooperative Memory Paging with Keyword Bookmarks for Long-Horizon LLM Conversations"
**Date**: 2026-04-14
**Relevance**: ★★★★★

## Core Contribution
Proposes **cooperative paging**: evicted context segments replaced with minimal keyword bookmarks ([pN:keywords], ~8-24 tokens), paired with a recall() tool for on-demand retrieval. On LoCoMo (10 multi-session conversations, 300+ turns):
- Outperforms ALL alternatives: truncation, BM25, word-overlap retrieval, search-tool baseline, AND full context
- Validated on 4 models (GPT-4o-mini, DeepSeek-v3.2, Claude Haiku, GLM-5), 4 independent LLM judges (p=0.017)

Key design-space findings from 5×4 ablation (3,176 + 1,600 probes):
1. **Coarse fixed pages (fixed_20) reach 96.7%** while content-aware topic_shift collapses to 56.7% — simpler is better
2. Eviction policy is data-dependent (FIFO best on synthetic, LFU on LoCoMo)
3. **Bottleneck is bookmark discrimination**: model triggers recall() 96% of the time but selects correct page only 57% when bookmarks are insufficiently distinctive
4. Keyword specificity alone accounts for 25pp accuracy difference

## Connection to Our Research
This is the most directly actionable paper for our **multi-session context management** challenge. The finding that cooperative paging **outperforms full context** is profound — it means that structured bookmarks + retrieval is literally better than having everything in the window. This validates the "less is more" principle we've seen in context pollution research (CR-335).

The bookmark discrimination bottleneck (57% correct page selection) maps exactly to our challenge of making context references distinctive enough to be useful. And the counterintuitive finding that coarse fixed pages beat sophisticated topic-shift segmentation echoes our earlier finding that simple hard gates outperform nuanced skills.

## Key Takeaways
- Bookmarks + recall() > full context (not just cheaper, actually better)
- Simpler page boundaries drastically outperform content-aware segmentation
- The hard problem is bookmark quality, not retrieval mechanism
- Directly applicable to persistent agent architectures
