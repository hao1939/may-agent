# KE-284: INDEX Titles Are Sufficient for 60% Knowledge Citation — Agents Use INDEX as Primary Source, Not Pointer

**Confidence**: ★★★☆ (directly measured in EXP-187, N=15)
**Source**: EXP-187 (control arm)
**Date**: 2026-04-19

---

## Claim

Agents achieve 60% correct knowledge entry citation using only INDEX.md titles, with near-zero file reads (avg 0.3). The INDEX functions as the primary knowledge source, not as a pointer to files. This means retrieval bottleneck interventions targeting "help agents find the right file" are solving the wrong problem for the majority of lookups.

## Evidence

EXP-187 control arm: 15 retrieval questions, each with one correct KE. Agents cited the correct KE 9/15 times (60%) while reading an average of 0.3 files. Agents extracted KE IDs directly from scanning the INDEX rather than opening individual entries.

The 40% failure rate concentrated on higher-numbered KEs (140, 143, 156, 171) — suggesting either position effects (attention drops later in INDEX) or inherent difficulty of those questions.

## Implications

1. **INDEX quality matters more than we thought** — it's not just a nav tool, it's the knowledge itself for most queries. Invest in INDEX entry quality (clear, specific titles) over retrieval mechanisms.
2. **Keyword tagging has low ceiling** — if 60% is achievable from titles alone, the max improvement from better INDEX structure is ~40pp, and realistic gains are much smaller.
3. **The real retrieval problem is the 40% tail** — entries that fail despite being in the INDEX. These may need better titles, better position, or structural changes (topic clustering, priority ordering).
4. **Measurement implication** — any experiment measuring "correct KE citation" is largely measuring INDEX scanning, not file retrieval. Designs requiring content quotation are needed to test actual retrieval.

## Connections

- Challenges: H-174 (keyword bookmarks — ceiling is lower than hypothesized)
- Supports: KE-210 (agents struggle with INDEX navigation — but reframes: the struggle is in the 40% tail, not broadly)
- Informs: Knowledge Consumability Plan (INDEX restructuring may be higher-leverage than assumed)
- Tested by: EXP-187


[SIG: generated]
