# DD-713/714 Analysis: Production Assessment Beyond Pass Rates

**Date**: 2026-04-14
**Sources**: DD-713 (4-pillar production framework), DD-714 (Claw-Eval trajectory grading)
**Connection targets**: KE-109 (5D gym-production gap), KE-110 (skill stack saturation), KE-181 (process vs product metrics)

---

## DD-713: Beyond Task Completion — 4-Pillar Production Assessment

### Key Finding
MontyCloud deployed an agentic AI system in production CloudOps and discovered binary task completion metrics are insufficient. They propose 4 pillars: LLM Evaluation, Memory Evaluation, Tool Evaluation, Environment Evaluation. Core insight: **non-determinism** in production creates failure modes invisible to controlled benchmarks.

### Connections to Our Knowledge Base

**KE-109 (5D gap) — Direct extension**: DD-713 independently validates all five gap dimensions (constraint density, temporal structure, context scale, evaluation alignment, agent state) from industry deployment at scale. Their finding that "production deployment revealed gaps invisible to pre-deployment evaluation" is exactly KE-109's thesis. They also suggest a **6th dimension we missed: non-determinism** — same input → different execution paths → evaluation must capture behavioral distributions. This is distinct from our existing 5 dimensions and worth adding.

**KE-110 (skill saturation) — Reinforces the exit from gym**: DD-713's production evidence shows that even perfect controlled-benchmark performance tells you nothing about production fitness. Our gym ceiling (91-100%) and their production gaps are the same phenomenon seen from opposite ends: we pushed gym to ceiling and found it couldn't represent production failures; they deployed to production and found it surfaced failures invisible to benchmarks.

**KE-181 (process vs product metrics) — Mapped to their 4-pillar structure**: Our KE-181 finding that process compliance ≠ product quality is a specific instance of their broader observation that "no single metric captures production fitness." Their 4-pillar decomposition is a framework for systematically separating what KE-181 warns about conflating:
- Pillar 1 (LLM) ≈ our product quality (reasoning correctness)
- Pillar 2 (Memory) ≈ our externalization/process quality 
- Pillar 3 (Tool) ≈ our operational compliance
- Pillar 4 (Environment) ≈ gap — we don't measure this

**4-pillar mapping to our existing work**:
| Pillar | Our Coverage | Key Entries |
|--------|-------------|-------------|
| LLM (reasoning quality) | Good — EXP-099 trajectory analysis, EXP-103 confabulation | KE-098, KE-102 |
| Memory (retrieval, state) | Partial — externalization research | DD-598, DD-712, H-161 |
| Tool (invocation correctness) | Emerging — DD-682/683 trajectory guards | CR-320 |
| Environment (integration, side effects) | **Gap** — no production environment monitoring | — |

### Verdict: Warrants KE update, not new KE
DD-713 validates and extends KE-109 rather than presenting a novel finding. **Recommendation**: Update KE-109 to add non-determinism as a 6th gap dimension and cite DD-713 as industry-scale validation. The 4-pillar framework is useful vocabulary but doesn't change our strategic direction — we already pivoted to production observation (KE-109 Path A).

---

## DD-714: Claw-Eval — Trajectory-Aware Grading

### Key Finding
Largest-scale trajectory-aware evaluation (300 tasks, 2,159 rubric items, 14 models). Triple evidence channels: execution traces, audit logs, environment snapshots. Quantitative headline: **44% of safety violations and 13% of robustness failures are invisible to final-output-only evaluation.** Introduces Pass@k (peak capability) vs Pass^k (worst-case reliability) — error injection degrades consistency (Pass^k drops 24%) while peak capability (Pass@3) holds stable.

### Connections to Our Knowledge Base

**KE-109 (5D gap) — Adds "evaluation methodology" as a gap dimension**: Claw-Eval quantifies something implicit in KE-109 but never measured: our gym uses final-output checking (pass/fail), which by DD-714's data misses ~44% of production-relevant failures. The gym-production gap isn't just about scenarios being too easy — it's also about our **evaluation methodology being too coarse**. Even if we had harder scenarios, pass/fail grading would miss nearly half of meaningful behavioral issues.

**KE-110 (skill saturation) — Reframes the ceiling**: Our 91-100% gym pass rate is Pass@1. If we measured Pass^3 (worst of 3 runs), we'd likely see lower rates, revealing inconsistency hidden by point estimates. The ceiling may be partly an artifact of single-trial measurement. This doesn't invalidate KE-110's conclusion (the gym improvement loop is complete), but it suggests the ceiling isn't as absolute as 91-100% implies.

**KE-181 (process vs product) — Converging evidence**: DD-714's core thesis — "trajectory-opaque evaluation is systematically unreliable" — is KE-181 generalized. KE-181 showed that checking only for artifact existence conflates process compliance with product quality. DD-714 shows the broader pattern: checking only final outputs misses 44% of safety violations. Both say the same thing: **what you check determines what you see, and single-dimension checks systematically miss multi-dimensional reality.**

**KE-101 (structure > content) — Alignment**: DD-714's finding that "error injection degrades consistency, not peak capability" maps to KE-101 Law 2. Structural robustness (Pass^k) separates from raw capability (Pass@k). Our structural interventions (guards, gates) target consistency — DD-714 validates that this is the right dimension to optimize.

**EXP-103 (verification confabulation) — Validated at scale**: Our finding that agents produce correct outputs via broken reasoning (EXP-103, 50-69% right-for-wrong-reasons per DD-688) aligns with DD-714's 44% safety miss rate. Both demonstrate that final outputs are insufficient evidence of correct agent behavior.

### Verdict: Warrants new hypothesis
DD-714 provides the strongest case yet for a specific, testable prediction: **our gym scores would be significantly lower under trajectory-aware evaluation.** This deserves a hypothesis.

---

## Synthesis: What DD-713 + DD-714 Tell Us Together

### Converging thesis
Both papers arrive at the same conclusion from different angles:
- DD-713 (from production deployment): binary metrics miss production-relevant failures
- DD-714 (from evaluation methodology): trajectory-opaque grading misses 44% of safety violations

Combined with our existing knowledge:
- KE-109 (from gym experiments): structural gap makes gym scores uninformative about production
- KE-181 (from methodology review): process/product conflation inflates apparent effects

**Meta-pattern**: The evaluation methodology gap may be as important as the environmental gap. Even within our current gym, switching from pass/fail to trajectory-aware multi-dimensional grading would likely reveal failure modes we're currently missing.

### Actionable ideas (ordered by value/effort)

1. **Add Pass^k metric to gym evaluation** (Low effort, High value)
   Run each gym scenario 3x and report Pass^3 alongside Pass@1. If 91-100% Pass@1 drops to <80% Pass^3, we've found hidden inconsistency worth investigating. This directly tests whether KE-110's ceiling is real or measurement-artifact.

2. **Non-determinism as 6th gap dimension in KE-109** (Low effort, Medium value)
   Update KE-109 to add behavioral variance as a gap dimension. DD-713 provides the evidence.

3. **Trajectory grading pilot** (Medium effort, High value)
   Pick one gym scenario and score not just final output but each step in the trajectory (tool choice quality, error recovery, reasoning soundness). Compare to pass/fail. If divergence is >20%, trajectory grading is worth building out. This is a KE-109 Path B step.

4. **Three evidence channels** (Medium effort, Medium value)
   We already have execution traces + audit logs. Adding environment snapshots (pre/post task state) completes the DD-714 triple. Low cost for significant diagnostic improvement.

### New hypothesis candidate
**H-NEW: Pass^k reveals hidden gym inconsistency**
- Claim: Gym scenarios at Pass@1 ≥ 91% will show Pass^3 ≤ 80%, revealing consistency failures masked by single-trial evaluation
- Test: Run 3 trials of each of the 7 ceiling scenarios, compute Pass^3
- Effort: ~21 gym runs ($1-3 total)
- If confirmed: Reopens the gym improvement loop on a new dimension (consistency vs capability)
- If refuted: Strengthens KE-110's ceiling finding

---

## Summary Table

| Paper | Key Number | Our Connection | Action |
|-------|-----------|----------------|--------|
| DD-713 | 4 pillars, 1 new gap dimension | Validates KE-109, extends to 6D | Update KE-109 |
| DD-714 | 44% safety misses, Pass^k vs Pass@k | Reframes KE-110 ceiling, generalizes KE-181 | New hypothesis, add Pass^k metric |

**Bottom line**: These papers don't change our strategic direction (we already pivoted to production observation per KE-109). But DD-714's Pass@k/Pass^k distinction offers a cheap, testable refinement: if our gym ceiling is partly a measurement artifact of single-trial evaluation, we can reopen the improvement loop on a consistency dimension without needing structural gym redesign.
