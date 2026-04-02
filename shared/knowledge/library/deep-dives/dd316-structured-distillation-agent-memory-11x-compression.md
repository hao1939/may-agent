# Deep Dive #316: Structured Distillation for Personalized Agent Memory — 11× Token Reduction with Retrieval Preservation

**Paper:** arXiv:2603.13017 (Lewis, 2026)
**Date:** 2026-03-16
**Venue:** cs.AI (preprint)

## One-Sentence Summary
A structured extraction method compresses one developer's 14,340 conversation exchanges (371→38 tokens avg, 11× compression) into compound retrieval objects, preserving 96% of verbatim MRR via vector search while keyword search degrades—revealing that distilled and verbatim text are complementary retrieval signals.

## Core Problem
Long conversations with AI agents create expensive memory: 500 past exchanges cost ~200K tokens. Current solutions (compaction/summarization) are lossy with no schema or extraction targets. The verbatim text is already persisted locally—what's missing is structured, indexed working memory, not better summarization.

## Method: Structured Distillation

### Exchange Segmentation
- Ply model: user message = half-ply, agent response completes exchange
- Filter: <100 char exchanges removed; >20 ply exchanges split
- Result: 14,340 exchanges → 12,427 distilled "palace objects"

### Compound Distilled Objects (4 fields)
| Component | Source | Content | Analogy |
|-----------|--------|---------|---------|
| exchange_core | LLM | What was accomplished (1-2 sentences) | Commit message |
| specific_context | LLM | One distinguishing technical detail | The diff |
| room_assignments | LLM | 1-3 thematic rooms (type, key, label) | Directory tree |
| files_touched | Regex | File paths referenced | Changed files |

### Key Design Principles
1. **Surviving vocabulary principle**: LLM reuses participants' exact terms, not synonyms
2. **Two-tier architecture**: Distilled text routes queries → user reads original verbatim
3. **Index ≠ display**: Distilled objects are retrieval artifacts, not user-facing
4. **Back-references**: Each object links to conversation_id, ply_start, ply_end

### Vocabulary Analysis
- Only 27% of top-15 highest-IDF tokens per verbatim exchange survive distillation
- BUT 96.8% of query vocabulary is retained—tokens users actually search for survive
- specific_context has 1.84× higher mean IDF than exchange_core (5.74 vs 3.13)

## Evaluation Design (Remarkably Rigorous)

### Scale
- 4,182 conversations, 14,340 exchanges, 6 software engineering projects
- 201 recall-oriented queries (conceptual, phrase, exact-term)
- **107 configurations**: 5 pure search modes × 4 mechanisms + 5 cross-layer modes
- 5 LLM graders × 214,519 consensus-graded query-result pairs
- TREC 0-3 relevance grading with majority-vote consensus

### Human Validation
- 108 human grades validating calibrated Claude Opus as 6th tie-breaking grader
- Post-calibration agreement: 95.7% (human vs Opus)
- Bonferroni-corrected significance testing (α = 0.05/40 = 0.00125)

## Key Results

### Headline Numbers
| Configuration | MRR |
|--------------|-----|
| Best verbatim (Full Text / BM25-FTS) | 0.745 |
| Best pure distilled (Core+Rooms / Exact / Weighted) | 0.717 (96%) |
| Best cross-layer (BM25(V)+HNSW(D) / CombMNZ) | **0.759** (102%) |

### The Mechanism-Dependent Result (Most Important Finding)
- **Vector search (HNSW, Exact)**: ALL 20/20 distilled configs show NO significant degradation after Bonferroni correction
  - Effect sizes: |d| ≤ 0.25 (negligible to small)
  - Best match: 100% of verbatim mean grade (1.992 vs 2.002)
- **Keyword search (BM25)**: ALL 20/20 configs show SIGNIFICANT degradation
  - Effect sizes: |d| = 0.031–0.756
  - 18/40 reach medium threshold (d ≥ 0.5)
  - 11× compression removes lexical overlap BM25 needs

### Cross-Layer Complementarity
- Best overall config fuses verbatim BM25 + distilled HNSW (MRR 0.759)
- This exceeds best pure verbatim baseline (0.745)
- Not distilled superiority—it's signal complementarity
- Oracle coverage: union of all configs solves 191/201 queries (95.0%)
- 32 queries solved ONLY by distilled configs (room assignments, file metadata create novel retrieval pathways)

### Query Type Interaction
- **Exact-term queries**: Distilled sometimes OUTPERFORMS verbatim (file metadata helps)
- **Conceptual queries**: Largest verbatim advantage (abstract semantics harder to compress)
- **Phrase queries**: Moderate degradation

## Critical Analysis

### Strengths
1. **Exceptional evaluation rigor**: 107 configs, 214K graded pairs, Bonferroni correction, bootstrap CIs, 5 LLM graders + human validation
2. **Practical architecture**: Two-tier (index + display) is immediately deployable
3. **Honest about limitations**: Single-user corpus, mechanism-dependent result, truncation bias
4. **Actionable insight**: "Use vector search on distilled, BM25 on verbatim, fuse results"
5. **Memory budget result**: 1,000 exchanges in ~39K tokens instead of ~407K

### Weaknesses
1. **N=1 user**: Single developer corpus—generalization unknown
2. **All-MiniLM-L6-v2**: Small embedding model (22M params); larger models would likely improve
3. **Haiku-distilled**: Quality depends on distillation LLM capability
4. **No online learning**: Static extraction, no adaptation from user behavior
5. **Room assignment quality**: LLM-generated rooms with free-form keys—no evaluation of room usefulness

### Open Questions
- Does the surviving vocabulary principle transfer to non-technical domains?
- Can structured distillation be applied incrementally (not batch)?
- What's the optimal embedding model size vs deployment constraint tradeoff?
- Can room assignments be learned from retrieval feedback?

## Relevance to Multi-Agent Systems

### Direct Applications
1. **Agent persistent memory**: Exactly the problem multi-agent systems face—how to maintain long-term context efficiently
2. **Memory compression for routing**: 11× reduction means agent history fits in routing context windows
3. **Two-tier retrieval architecture**: Applicable to any agent needing fast recall over conversation history
4. **Cross-layer fusion**: Combining different representations of same content is directly applicable to multi-agent memory sharing

### Connection to Our Research Threads
- **Context compression** (ReBalance, token efficiency): Complementary approach—ReBalance optimizes reasoning tokens, this optimizes memory tokens
- **Agent memory** (AMA-Bench): Structured distillation addresses the long-horizon memory challenge from a retrieval angle
- **Tool use**: files_touched field creates tool-action-aware memory
- **Evaluation methodology**: 107-config evaluation with consensus grading is gold standard for agent memory research

## Impact Assessment: 8.0/10
Highly practical work solving a real deployment problem with exceptional evaluation rigor. The mechanism-dependent finding (vector search preserves quality, BM25 doesn't) is actionable and surprising. The N=1 limitation is honest but real. The cross-layer complementarity result (102% of verbatim MRR) suggests the future of agent memory is heterogeneous retrieval over multiple representations.
