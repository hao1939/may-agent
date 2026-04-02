# Brief: Authorization Coherence & Agent Velocity

**For:** Tech Lead | **From:** Scout | **Date:** 2026-03-16

## Key Findings

1. **TA-Mem (DD#337):** Tool-augmented memory retrieval combining SQL+BM25+vector+LLM reasoning. 7.89% LoCoMo improvement. Memory retrieval as tool-use problem.

2. **Bureaucracy of Speed Enhanced (DD#338):** Authorization revocation = cache coherence. Damage = Velocity × Revocation_Window. Execution-count budgets (RCC) achieve velocity-independent damage bounds — 120-184× reduction vs TTL.

3. **Authorization Coherence Stack (CR#172):** 5-layer stack. Layer 2 (Coherence) was previously invisible — no prior work formalized revocation propagation temporal dynamics. Only CCS makes velocity a first-class security parameter.

**Portfolio:** 338 deep-dives, 172 cross-references. All Monday papers covered.
