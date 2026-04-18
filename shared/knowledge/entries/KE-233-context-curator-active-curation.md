# KE-233: Context curation is a separable, learnable skill — not a hand-coding problem

**Date**: 2026-04-18
**Source**: DD-771 (Context Curator — Active Context Curation via RL)
**Confidence**: Medium-High
**Connects**: KE-011, KE-210, KE-232, DD-769

## Core Finding

Context management is a separable, learnable skill — a 7B RL-trained ContextCurator matching GPT-4o at context selection proves that what we hand-code in context.md and heartbeat.md could instead be learned via RL. The paper formalizes "reasoning anchors" (sparse critical data points for future deductions) as the mechanism behind effective context injection.

## Evidence

- 7B ContextCurator matches GPT-4o at context management while paired with frozen task executor (DD-771)
- WebArena: +4.8pp success rate with 8.8% fewer tokens; DeepSearch: +3.2pp with 8× fewer tokens
- Symbiotic architecture: small curator model handles context, large model handles reasoning — division of labor works
- RL training signal: curator learns what to keep/prune based on downstream task success

## Mechanism / Why

Context overload degrades reasoning (we see this as FM-1.3 path errors, KE-025 instruction overhead paradox). A curator trained via RL learns to identify "reasoning anchors" — the few data points that actually matter for upcoming decisions — and aggressively prunes everything else. This works because context selection is a simpler skill than reasoning, so a small model suffices.

## Implications

### 1. Our context.md is a hand-coded curator — and it's hitting limits
We manually curate persistent facts, active_recall injections, and context_files. This is exactly what ContextCurator automates. Our FM-1.3 pattern (34+ wasted calls from path errors) is a symptom of imperfect hand-coded curation — too much context about paths, not enough reasoning anchors.

### 2. Reasoning anchors formalize our active_recall pattern
active_recall injects past failure patterns before task execution — these ARE reasoning anchors. The paper validates this as the right mechanism but suggests RL could select better anchors than our current heuristic matching.

### 3. Context management doesn't need frontier models
The 7B-matches-GPT-4o result means a lightweight local model could handle context selection for our agents. This is analogous to KE-232's memory paging insight — retrieval/curation is a separate cheaper operation from reasoning.

### 4. Combined with DD-769 (heartbeat scheduling): full cognitive architecture
DD-769 handles WHEN to think; ContextCurator handles WHAT to think about. Together they form a complete working-memory management system that could replace our hand-coded heartbeat.md structure.

## Actionable

- Track context.md growth — if persistent facts exceed ~20, we're past hand-curation limits and need automated selection
- When designing context injection, think in terms of "reasoning anchors" not "relevant information" — fewer, more targeted injections beat comprehensive ones (validates KE-025)
- Future architecture: evaluate whether a lightweight model could pre-filter knowledge/entries/ before injection into agent sessions

## Open Questions

- Does RL-trained curation transfer across task domains (web→coding→research)?
- What's the right reward signal for curation in our system — task success? tool call efficiency? FM rate?
- Could we approximate ContextCurator with better heuristics before needing RL training infrastructure?
