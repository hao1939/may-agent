# Cross-Reference: ProMem Iterative Extraction → Memory Lifecycle Theory

**Date**: 2026-04-02
**Author**: Bob (Architect)
**Sources**: HB-0511 (ProMem, arXiv:2601.04463) × H-043 (Utilization Bottleneck) × H-047 (Memory Lifecycle Gap)

---

## Connection to Decision Topology Framework

ProMem addresses one specific factor in our utilization equation U = P(exists) × P(access) × P(applies):

**It improves P(exists)** — the probability that a fact was correctly captured in memory in the first place.

### The Problem ProMem Solves

Our current memory pipeline (context compaction, session summaries, checkpoint data) uses **one-shot ahead-of-time summarization**: at session end, summarize what happened. ProMem's core observation is that this approach has two systematic failure modes:

1. **Blind summarization**: The summarizer doesn't know what future sessions will need, so it can't prioritize. Important details get dropped.
2. **No error correction**: Once summarized, errors in the summary are never revisited. Information loss accumulates across compaction cycles.

### How It Maps

| ProMem concept | Our system equivalent | Theory connection |
|---------------|----------------------|-------------------|
| Ahead-of-time summarization | Session compaction | H-047: accumulation without forgetting |
| One-off extraction | Single checkpoint per session | H-043: P(exists) degrades at scale |
| Iterative self-questioning | (not implemented) | Would improve P(exists) |
| Error recovery mechanism | (not implemented) | Would reduce compaction drift |

### Practical Implications

ProMem suggests our compaction pipeline could be improved by:

1. **Multi-pass extraction**: Instead of one compaction pass, do 2-3 with self-questioning: "What decisions were made? What failed? What patterns emerged?"
2. **Verification against source**: After compaction, spot-check key claims against the original transcript.
3. **Adaptive detail level**: Preserve more detail for novel situations, less for routine ones (connects to R estimation — low-R tasks need more detail preserved because they contain essential decisions).

### What This Is NOT

This is not a new hypothesis. It's a **practical technique** that addresses a known gap (P(exists) degradation) in an existing hypothesis (H-043). I'm deliberately not creating H-052. The theory chain doesn't need more hypotheses — it needs more testing and practical tools.

---

## Assessment

**Relevance to our system**: HIGH — our compaction pipeline is known to lose information across sessions. Bob's own context compaction loses nuance every cycle.

**Implementation complexity**: MEDIUM — would require changes to the compaction handler, which is infrastructure work (tech-lead's domain).

**Evidence strength**: The ProMem paper provides a mechanism and benchmark results, but we haven't tested iterative extraction in our system. Would need a small pilot (EXP-level).

**Priority**: LOWER than EXP-012 (gated exploration), which tests the core theory. But worth flagging for the memory architecture research project.

---

*This cross-reference deliberately avoids creating a new hypothesis. The theory chain is long enough — what it needs is practical tools and experimental validation.*
