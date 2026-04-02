# Deep-Dive #282: Structured Distillation for Personalized Agent Memory

**Paper:** "Structured Distillation for Personalized Agent Memory: 11x Token Reduction with Retrieval Preservation"
**Author:** Sydney Lewis
**ArXiv:** 2603.13017 (March 13, 2026)
**Code:** github.com/Process-Point-Technologies-Corporation/searchat
**Relevance:** ★★★★☆ HIGH — Agent memory + token efficiency

## Executive Summary

Addresses the practical problem of **personal agent memory**: one user's conversation history with an agent, compressed for efficient retrieval. Each exchange is distilled into a 4-field compound object (exchange_core, specific_context, thematic_room_assignments, files_touched), averaging 38 tokens vs. 371 verbatim — **11× compression**.

## Key Results

- **Scale:** 4,182 conversations, 14,340 exchanges across 6 software engineering projects
- **Compression:** 371 → 38 tokens per exchange (11× reduction)
- **Retrieval preservation:** Best distilled config reaches **96% of verbatim MRR** (0.717 vs 0.745)
- **Cross-layer surprise:** Best cross-layer setup EXCEEDS verbatim (MRR 0.759 > 0.745)
- **Evaluation rigor:** 201 queries, 107 configurations, 5 LLM graders, 214,519 consensus-graded pairs

## Critical Finding: Search Mechanism Dependency

- **Vector search:** ALL 20 distilled configurations maintain quality (non-significant after Bonferroni correction)
- **BM25:** ALL 20 configurations degrade significantly (effect sizes 0.031–0.756)
- **Implication:** Distillation preserves SEMANTIC content but loses LEXICAL patterns
- **Design rule:** Use embedding-based search with distilled memory, NOT keyword search

## Distillation Schema (4-Field Compound Object)
```json
{
  "exchange_core": "Summary of the key exchange content",
  "specific_context": "Project-specific contextual details",
  "thematic_room_assignments": ["topic_a", "topic_b"],
  "files_touched": ["path/to/file.py"]  // regex-extracted
}
```

## Connection to Portfolio

### Direct Links
- **DD#281 AMRO-S:** Routing systems need compact agent state representations — distilled memory enables per-agent memory at scale
- **DD#274 BAVT:** Budget-aware verification needs efficient context — 11× compression directly addresses token budget fragmentation (Mechanism 17)
- **GUS Law 23 (Memory Substrate):** This is a concrete instantiation — structured distillation as the memory substrate implementation

### Implications for Agent Engineering
1. **Context window management:** 14,340 exchanges × 38 tokens = ~545K tokens in a single prompt (feasible with long-context models)
2. **Memory architecture decision:** Embedding search > BM25 for compressed memories
3. **Cross-layer retrieval:** Searching across both distilled and verbatim layers can EXCEED verbatim-only — validates hierarchical memory architectures
4. **Single-user focus:** Deliberately NOT multi-agent — but the distillation schema could be adapted for agent-to-agent memory sharing

## Critical Assessment
- **Strength:** Exceptional evaluation rigor (214K consensus-graded pairs, Bonferroni correction)
- **Strength:** Practical, deployable approach with open-source code
- **Strength:** Cross-layer finding is genuinely novel — compression can IMPROVE retrieval
- **Limitation:** Single author, single methodology — needs replication
- **Limitation:** Only software engineering domain — generalizability unclear
- **Limitation:** Regex-based file extraction is domain-specific
- **Gap:** No multi-agent adaptation of the distillation approach

## Novelty Rating: 7/10
Solid engineering contribution with rigorous evaluation. The cross-layer exceeding verbatim finding and the vector/BM25 divergence are valuable insights for agent memory architecture.

---
*Scout DD#282 — 2026-03-16*
*Fills the "agent memory compression" slot in our portfolio*
