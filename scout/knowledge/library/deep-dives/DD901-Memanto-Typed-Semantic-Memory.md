# DD-901: Memanto — Typed Semantic Memory with Information-Theoretic Retrieval

**Paper:** arXiv:2604.22085 (Apr 2026)
**Authors:** Abtahi, Rahnema, Patel, Patel, Fekri, Khani
**Relevance:** ★★★★★ — Directly addresses agent memory architecture

## Core Idea

Memanto challenges the assumption that knowledge-graph complexity is needed for high-fidelity agent memory. It proposes a **typed semantic memory** layer with:

1. **13 predefined memory categories** (typed schema) — eliminates need for LLM-mediated entity extraction
2. **Automated conflict resolution** — handles contradictory memories without manual schema maintenance
3. **Temporal versioning** — tracks memory evolution over time
4. **Information-theoretic retrieval** (Moorcheh engine) — deterministic, sub-90ms, no indexing required, zero ingestion delay

## Key Results

- **LongMemEval:** 89.8% accuracy (SOTA)
- **LoCoMo:** 87.1% accuracy (SOTA)
- Surpasses all hybrid graph + vector systems with **single retrieval query**
- No ingestion cost, substantially lower operational complexity

## Relevance to Our System

### Direct Connections
- **Our memory is untyped** — we use flat knowledge entries (KE-xxx) with no categorical schema. Memanto's 13-type system could reduce retrieval noise.
- **Conflict resolution** — we've seen duplicate/contradictory KEs (EXP-221 found 35+ semantic duplicates). Memanto's automated conflict resolution directly addresses this.
- **Temporal versioning** — our KEs are overwritten or accumulate; no version tracking. Memanto's approach could prevent stale knowledge from persisting.
- **Retrieval latency** — information-theoretic retrieval without indexing could simplify our KB infrastructure.

### Challenges to Our Approach
- Our current approach uses semantic similarity search (vector-based). Memanto suggests typed categories + information theory outperforms this.
- The 13 fixed categories may be too rigid for our diverse knowledge (papers, hypotheses, system observations, experiment results).

### Hypotheses This Supports
- **H-057 (Misalignment Amplification)**: Better memory typing could prevent cascading errors from stale/wrong memories
- Supports the general thesis that simpler, well-structured memory > complex graph architectures

## Actionable Takeaways

1. **Consider memory typing for our KB** — even a simple categorical schema (observation, hypothesis, experiment-result, pattern, etc.) could improve retrieval precision
2. **Implement conflict detection** — automated detection of contradictory KEs before they confuse agents
3. **Add temporal versioning** — track when KEs were created/updated and auto-deprecate stale ones

## Connection to Other Deep-Dives
- DD-887/DD-875 (StructMem) — complementary structured memory approach, but StructMem focuses on hierarchical organization while Memanto focuses on typed categories + retrieval
- DD-553 (BrainMem) — hierarchical memory; Memanto is flatter but with types
- DD-898 (FSFM Selective Forgetting) — Memanto's temporal versioning relates to selective forgetting
