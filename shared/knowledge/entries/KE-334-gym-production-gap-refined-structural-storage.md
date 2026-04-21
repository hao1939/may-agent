# KE-334 — Gym-Production Gap Refined: "Learn in Production, Store Structurally" Dissolves the Dichotomy

**Rating**: ★★★★  
**Source**: DD-832 (Agent Learning Mechanisms: Voyager, MemGPT/Letta, Reflexion)  
**Connects**: KE-101 (Law 1), KE-106 (Guards Don't Train), EXP-100, EXP-107, KE-330, KE-331, KE-332  
**Date**: 2026-04-21

## Core Finding

DD-832 maps three agent learning systems onto the gym-production spectrum, revealing the gap may be a false dichotomy:

| System | Position on Spectrum | Transfer Model |
|--------|---------------------|----------------|
| **Reflexion** | Pure gym — requires re-execution of same task | Backward-correction only (retry task A with reflections) |
| **Voyager** | Gym-that-transfers — skills from world A work in world B | Forward-transfer (learn on task A, apply to task B) |
| **MemGPT** | Pure production — all learning via in-situ memory edits | No practice phase; learns by making production mistakes |

**Key insight**: Voyager suggests "learn in production, store structurally so skills compound" may dissolve the gym-production distinction. Skills learned during real work, if stored composably, become the training data for future work. Our checkpoint/context/knowledge system already does a version of this — but without the semantic retrieval and compositionality that makes Voyager's version compound.

## KE-106 Validation

Reflexion provides the cleanest validation of KE-106 (Guards Don't Train Behavior):
- **Evaluator alone** (LAST_ATTEMPT strategy): modest improvement
- **Evaluator + self-reflection** (REFLEXION strategy): dramatically better
- Ablation directly proves: knowing-you-failed (guard signal) ≠ knowing-how-to-improve (training mechanism)

This maps exactly to our finding: guards catch errors but don't teach better behavior. A separate reflection/training mechanism is required.

## Implications

1. **For our system**: Invest in structured storage of production-learned lessons (typed, retrievable, composable) rather than building separate training environments
2. **For experiment design**: Reflexion-style retry experiments (EXP-100/107) test only one point on the spectrum; Voyager-style forward-transfer experiments would test the more production-relevant pattern
3. **Refines EXP-100/107**: The gym-production gap is really a *storage-and-retrieval* gap — production learning happens naturally, but without structural persistence it evaporates between sessions
