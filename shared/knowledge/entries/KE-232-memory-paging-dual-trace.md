# KE-232: Cooperative Paging + Dual-Trace Encoding Map Directly to Our Checkpoint/Context Architecture

**Date**: 2026-04-18
**Source**: DD-765, DD-764
**Confidence**: Medium-High
**Connects**: KE-011, CR-335

## Core Finding

DD-765 shows cooperative paging (keyword bookmarks replacing evicted context + recall tool) **outperforms full context** — structured forgetting with retrieval hooks beats keeping everything. DD-764 shows dual-trace encoding (pairing facts with narrative scene traces) gives +20pp retrieval, concentrated in temporal reasoning (+40pp) and cross-session aggregation (+30pp). Together they prescribe a two-layer memory architecture: **coarse keyword bookmarks** for session-level paging, and **scene-enriched traces** for semantic knowledge entries.

## Evidence

- DD-765: Cooperative paging beats full context on LoCoMo (p=0.017, 4 models, 4 judges). Coarse fixed pages (96.7%) crush content-aware topic segmentation (56.7%).
- DD-765: Bottleneck is bookmark discrimination — model triggers recall 96% of the time but picks right page only 57% when bookmarks are vague.
- DD-764: Dual-trace +20.2pp over fact-only on LongMemEval-S (p < 0.0001). Zero additional encoding cost.
- DD-764: No benefit for single-session retrieval — this is specifically a cross-session technique.

## Mechanism / Why

Bookmarks work because they reduce the search space while preserving retrieval cues — the model doesn't need full context, just enough signal to know *what to recall*. Dual-trace works because narrative scene context creates multiple retrieval paths to the same fact (temporal, spatial, causal), making cross-session recall more robust. The two are complementary: bookmarks handle session-level granularity, scene traces handle fact-level enrichment.

## Implications

### 1. Our checkpoints are proto-bookmarks but lack keyword discrimination
Our checkpoint summaries (1-2 sentences + structured data) function like DD-765's bookmarks. But the discrimination bottleneck (57% correct page selection) warns us: if checkpoint summaries are too generic ("made progress on X"), the system can't select the right one. We need distinctive keywords per checkpoint.

### 2. Our KE entries already partially do dual-trace encoding
KE files include Source, Evidence, and Mechanism sections — this is richer than bare facts. But we don't capture the *narrative moment* (which session, what prompted the discovery, what we were doing). Adding a brief "Discovery Context" line to KEs could activate the dual-trace benefit for cross-session retrieval.

### 3. Context.md is our "full context" — and may be suboptimal
DD-765's most striking finding is that full context is *worse* than bookmarks + recall. Our context.md accumulates facts indefinitely. A paged approach — keeping only keyword-indexed bookmarks for older knowledge, with a recall mechanism — could outperform the current design.

## Actionable

- **Checkpoint quality**: Ensure checkpoint summaries contain distinctive keywords (specific file names, hypothesis IDs, concrete findings), not generic progress descriptions
- **KE enrichment**: Consider adding a one-line "Discovery Context" field to KE template capturing the narrative moment
- **Context.md experiment**: Test replacing older context.md entries with keyword bookmarks + a retrieval mechanism (H-candidate for future experiment)

## Open Questions

- What's the right granularity for our "pages"? DD-765 found coarse fixed pages beat topic-aware segmentation — does that mean time-based checkpoints (every N sessions) beat content-based ones?
- How distinctive do our checkpoint keywords need to be? The 25pp accuracy difference from keyword specificity suggests this is high-leverage
- Would dual-trace encoding help our auto-matched knowledge retrieval (the system that populates "Relevant Knowledge" in session context)?
