# DD#558: Caveman — Token Compression as Agent Infrastructure

**Date:** 2026-04-06
**Rating:** ★★★★½ (High practical relevance + connects 3 active research threads)
**Source:** github.com/JuliusBrussee/caveman (3.9K★), HN (538 points)

## Summary

Caveman is a Claude Code "skill" that compresses LLM output by ~75% through pidgin-style encoding: dropping articles, prepositions, vowels in common words, using abbreviations. Preserves code blocks at full fidelity. Critical insight: compression operates at L2 (encoding layer) AFTER reasoning, preserving reasoning depth while reducing communication overhead. This is fundamentally different from DD#556's effort crisis which cuts reasoning tokens.

## Key Findings

1. **Communication stack decomposition**: Agent communication has 4 layers — L4 (task semantics), L3 (protocol), L2 (encoding), L1 (transport). Caveman optimizes L2 independently of L3-L4, a previously invisible optimization dimension.
2. **Compression ≠ quality loss**: Multiple users report compressed output correlates with HIGHER quality, suggesting forced conciseness acts as implicit regularizer against attention diffusion.
3. **Latency > cost**: Primary user value is faster response times, not cheaper bills. Output token generation is the bottleneck.
4. **Multi-agent compound effect**: In N-agent system, 75% compression at communication layer yields 4× cost reduction + context window savings (compressed inter-agent messages leave room for task content).
5. **Encoding layer as harness parameter**: Agent "dialect" is configurable — harness engineering extends to communication protocol design, not just task orchestration.

## Predictions
- P319: Caveman-style compression will become default in ≥3 major coding agent frameworks within 6 months
- P320: Multi-agent frameworks will add configurable "communication density" parameters within 12 months
- P321: Role-specific compression variants will emerge within 6 months
- P322: Forced conciseness will be empirically validated as improving correctness

## Cross-References
- **KE-087**: Agent Infrastructure Primitives (token compression as infrastructure)
- **DD#556**: Effort crisis (cuts reasoning — Caveman cuts communication)
- **CR#297**: Input Quality Thesis (Caveman compatible with all input improvements)
- **KE-082**: Reasoning dropout (compression must not bleed into reasoning)
