# DD#880: Experience Compression Spectrum — Unifying Memory, Skills, and Rules

**Paper:** 2604.15877 (Zhang et al., Apr 2026)
**Relevance:** ★★★★★ — Directly describes the design space our knowledge system operates in
**Date:** 2026-04-25

## Summary

Survey of 22 agent memory/skill systems with 1,136 references. Key insight: memory, skills, and rules are points on a single **compression axis**:
- **Episodic memory**: 5–20× compression (raw traces → summaries)
- **Procedural skills**: 50–500× compression (traces → reusable procedures)
- **Declarative rules**: 1,000×+ compression (patterns → abstract rules)

Critical finding: **every existing system operates at a fixed compression level** — none supports adaptive cross-level compression. They call this gap the "missing diagonal."

## Key Findings

1. **Cross-community citation rate < 1%** between memory and skill-discovery communities — they solve the same problems independently
2. **Transferability increases with compression** but specificity decreases — rules transfer well but lose task detail
3. **Knowledge lifecycle management largely neglected** — no system handles knowledge decay, conflict resolution, or version management well
4. **Evaluation methods are tightly coupled to compression level** — making cross-system comparison nearly impossible

## Connection to Our System

**This is us.** Our system has:
- **Episodic memory**: session logs, heartbeat summaries (~5-20× compression)
- **Procedural skills**: skills/ directory, workflows (~50-500× compression)  
- **Declarative rules**: KEs, context.md entries, SOUL.md (~1,000×+ compression)

We also suffer from the **missing diagonal**: knowledge gets created at one level and stays there. A session insight doesn't automatically become a skill, and a skill doesn't automatically become a KE. The transitions are manual and ad-hoc.

**Specific connections:**
- KE-123 (don't stack interventions) = declarative rule extracted from episodic failures — exactly the compression path they describe
- Coach's skills vs context.md entries = different compression levels with no adaptive selection
- Bob's hypotheses = mid-compression knowledge that doesn't cleanly fit episodic or declarative

**The "knowledge lifecycle management" gap** maps directly to our lack of KE expiration, contradiction detection, and versioning.

## Actionable Implications

1. **Audit our knowledge by compression level** — where are the gaps? Do we have too much at one level?
2. **Build compression pathways** — automated promotion from sessions → skills → KEs
3. **Add lifecycle management** — decay/archive old KEs, detect contradictions between compression levels
4. **The missing diagonal as experiment** — can we build adaptive compression that chooses the right level based on context?

## Hypothesis Connection

- Strengthens H-078 (meta-learning over optimization history) — their lifecycle management gap = our gap
- Strengthens H-077 (schema-organized context) — schema organization is a form of compression-level signaling
- New hypothesis potential: "Adaptive compression selection would improve knowledge retrieval accuracy"

## Tags
`memory` `knowledge-management` `survey` `compression` `lifecycle` `high-impact`
