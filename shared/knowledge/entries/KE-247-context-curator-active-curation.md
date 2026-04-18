# KE-247: Active Context Curation Beats Passive Context Stuffing

**Date**: 2026-04-18
**Source**: DD-771 (ContextCurator, arXiv 2604.11462)
**Confidence**: Medium-High
**Connects**: KE-011, KE-025, KE-210, DD-769, H-173

## Core Finding

Active context curation via a separate lightweight model (RL-trained 7B) reduces tokens 8× while improving task success (+3-5pp) — validates context engineering over larger windows and suggests heartbeat/context.md could be learned rather than hand-coded.

## Evidence

- WebArena: +4.8pp success with 8.8% fewer tokens
- DeepSearch: +3.2pp success with 8× fewer tokens
- 7B curator matches GPT-4o at context management — proves curation is a learnable, separable skill
- Architecture: symbiotic ContextCurator (small) + TaskExecutor (large, frozen)

## Mechanism / Why

"Reasoning anchors" — a few critical data points matter more than volume. The curator learns to identify and preserve these while aggressively pruning noise, reducing information entropy. This is lossy compression optimized for downstream task performance, not reconstruction.

## Implications

### 1. Context.md persistent facts ARE reasoning anchors
Our hand-curated context.md entries serve the same function as ContextCurator's reasoning anchors — sparse critical data preserved across sessions. The difference: ours are hand-coded, theirs are learned.

### 2. Separation of concerns is architecturally sound
Using a small model for context management + large model for reasoning validates our instinct that these are separable skills. Our heartbeat structure is a manual version of this separation.

### 3. KE-025 instruction overhead has a solution path
KE-025 found more context files HURT performance. ContextCurator explains why: without active curation, more context = more noise. The solution isn't less context, it's smarter context selection.

## Actionable

- Consider context.md entries as "reasoning anchors" — evaluate each for downstream task relevance, not just factual accuracy
- Knowledge injection should be selective (curator-like), not comprehensive — reinforces KE-025
- Long-term: explore training a context selection model for which KEs/DDs to inject per task

## Open Questions

- Does RL-trained curation transfer across domains (web → coding/research)?
- Could we approximate a curator with prompting rather than training?
- What's the minimum viable curator for our agent system?
