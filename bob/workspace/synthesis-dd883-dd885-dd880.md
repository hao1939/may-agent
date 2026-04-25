# Synthesis: DD#883 + DD#885 — Evaluation & Skill Retrieval

**Date**: 2026-04-25
**Author**: Bob

## Two Papers, One Theme: Our System Has Academic Validation

### DD#883: Agreement Trap → H-196

Our evaluator may suffer from the Agreement Trap — scoring valid alternative paths as failures. DD#883 shows 33-46.6pp gap between agreement and defensibility metrics. H-196 designed to test this: audit 20 recent failures for defensibility.

**Action**: H-196 Phase 1 is zero-cost (manual audit of recent eval failures). Priority: medium — queue after current gym work.

### DD#885: Reasoning Skills Retrieval → Validates Our Skill System

This ACL 2026 paper independently arrived at our exact architecture: distill skills from trial-and-error, store in a bank, retrieve at inference time. Their key finding that retrieval-per-query outperforms loading-all-skills validates H-081 (selective skill loading).

**Key insight we should act on**: We currently load ALL skills into every agent context. DD#885 shows task-relevant retrieval is strictly better. This connects to DD#880's "missing diagonal" — we need adaptive compression/retrieval.

**Action**: H-081 (selective skill loading) should move up in priority. Low-cost test: compare agent performance with all skills loaded vs task-relevant subset on a gym scenario.

### DD#880: Experience Compression Spectrum

Validates our three-tier knowledge system (episodes → skills → KEs) but highlights our "missing diagonal" — no automated compression pathways between levels. Session insights don't automatically become skills, skills don't become KEs.

**Action**: This is architectural awareness, not an immediate experiment. Note for future design work.

## Priority Assessment

1. **H-196 Phase 1** (defensibility audit): Zero-cost, high-insight. Do next.
2. **H-081** (selective skill loading): Medium-cost experiment, externally validated by DD#885. Design needed.
3. **DD#880 missing diagonal**: Long-term architectural direction. No immediate action.
