# Memory Forest — Verifiable Local Memory Architecture for Long-Running Agents

- **Date:** 2026-07-23
- **Source:** GitHub trending / AI agent memory
- **Repo:** https://github.com/hyungchulc/memory-forest
- **Stars:** 12 (created 2026-07-22)
- **License:** MIT
- **Language:** Python 3.11+

## Summary

Memory Forest is a local-first, filesystem-canonical memory architecture that gives long-running AI agents structured, auditable memory with provenance tracking. It addresses the common failure mode where agents either keep too little context or accumulate an unstructured pile that's hard to retrieve and impossible to audit.

## Key Design Properties

1. **Layered memory hierarchy** — Six numbered layers from raw chronology (ISTM) up through daily digests, short-term memory (STM), medium-term branches (MTM), long-term domain trees (LTM), to root-level anchors (XLTM). Layer placement is a responsibility decision, not a confidence score.

2. **Provenance-preserving promotion** — Claims promoted to higher layers retain pointers to the evidence that justified them. Wikilinks preserve evidence paths between adjacent layers.

3. **Route-first retrieval** — Default queries return relative paths and ranking metadata, not raw bodies. The caller must explicitly open, resolve conflicts, and check freshness.

4. **Root-first trail materialization** — `retrieve` ranks lexical matches globally, materializes each through the canonical layer chain, hash-checks integrity, returns metadata-only trails.

5. **Rebuildable derived state** — Indexes (SQLite) are disposable; the Markdown filesystem is canonical. Delete and rebuild indexes without data loss.

6. **No network dependency** — Fully local-first; no hosted service or external auth required.

## Architecture Pattern

```
Observed source → ISTM (raw) → Daily (readable) → STM (detailed) → MTM (recurring) → LTM (durable) → XLTM (root anchors)
```

Side archive (`00 life_archive`) holds reusable historical records. Similarity edges, embeddings, and visualizations are explicitly treated as disposable derived state.

## Signal & Relevance

- Addresses a real gap: most agent memory systems (MemGPT, Letta, etc.) are hosted or opaque. This is filesystem-native and human-readable.
- The "provenance trail" pattern — every durable claim links back to dated evidence — is directly applicable to knowledge management in agentic workflows.
- The explicit separation of "canonical content" vs "derived indexes" is a clean architectural boundary that prevents vendor lock-in.
- Early stage (12★, alpha) but the design document is unusually thorough for its maturity. Watch for adoption signals.

## Limitations

- Alpha quality, no runtime dependencies but also limited integrations.
- No embedding-based retrieval yet (lexical only in v0.2).
- Korean developer origin; bilingual docs suggest Korean AI-agent community investment in memory infra.

## Tags

`agent-memory` `local-first` `provenance` `knowledge-management` `filesystem-canonical`
