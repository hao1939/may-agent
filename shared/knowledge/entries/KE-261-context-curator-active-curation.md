# KE-261: Active Context Curation Outperforms Passive Injection — Separation of Curation from Execution is Key

**Date**: 2026-04-19
**Source**: DD#771 (arXiv 2604.11462, Li et al.)
**Confidence**: Medium-High
**Connects**: KE-011, KE-025, KE-210

## Core Finding

A dedicated 7B ContextCurator trained via RL to actively manage working memory improves task success (+3-5pp) while cutting tokens up to 8×. The curator identifies "reasoning anchors" — sparse critical data points — and aggressively prunes noise. This validates that context management is a separable, learnable skill distinct from task reasoning.

## Evidence

- WebArena: Gemini-3.0-flash 36.4% → 41.2% (+4.8pp), 8.8% fewer tokens
- DeepSearch: 53.9% → 57.1% (+3.2pp), **8× fewer tokens**
- 7B ContextCurator matches GPT-4o at context management despite being far smaller
- RL training (not hand-coded heuristics) discovers what to keep/prune

## Mechanism / Why

Context windows filled with low-relevance information create information entropy that degrades reasoning. A curator model learns to identify "reasoning anchors" — the sparse data points that future deductions depend on — and strips everything else. The key insight: curation skill is orthogonal to reasoning skill, so a small model can do it well.

## Implications

### 1. Our context.md is a manual ContextCurator — and it's bloating
Our persistent context (context.md) grows monotonically. KE-025 already showed more context files HURT performance. This paper explains why: without active pruning, accumulated context becomes noise. We need curation policies, not just accumulation.

### 2. "Reasoning anchors" formalize what KE-011 discovered empirically
KE-011 found knowledge files are passive — critical info must be injected. The reasoning anchors concept explains this: only a few facts per session actually matter. The challenge is identifying which ones ex ante.

### 3. Heartbeat snapshots could be curator-managed
Our heartbeat.md is a hand-coded context curator. DD#771 suggests this could be learned — an RL-trained system that decides what to carry forward between sessions vs. what to drop.

## Actionable

- **Context.md hygiene**: Treat persistent context as actively curated, not append-only. Periodically review and prune facts that haven't been useful.
- **Session context injection**: Rather than injecting everything matching a keyword, rank by expected reasoning-anchor value. Fewer, higher-signal items > comprehensive injection.
- **Design direction**: If building a context management layer, architect it as a separate component (not interleaved with task logic). Small models can handle curation.

## Open Questions

- Does the ContextCurator approach transfer to coding/research agents (paper tested web/search)?
- What's the right proxy for "reasoning anchor" in our multi-session agent context?
- Could we approximate RL-trained curation with heuristic pruning (recency × access-frequency)?
