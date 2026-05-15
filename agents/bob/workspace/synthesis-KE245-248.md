# Synthesis: KE-245 through KE-248 (DD-769–773)

**Date**: 2026-04-18
**KEs**: KE-245, KE-246, KE-247, KE-248 (×2: scheduling + memory)

## Executive Summary

Five KEs from five papers converge on a single meta-theme: **the gap between hand-coded and learned cognitive architecture**. Every paper independently validates a pattern we already implement manually, then shows how learning-based versions outperform the manual ones. This strengthens H-173 (adaptive meta-cognitive resource allocation) and suggests a new hypothesis about architectural maturity stages.

## Key Findings by Thread

### Thread 1: DD-769 (Agent Survey) → KE-246 + DD-770 (Heartbeat Scheduling) → KE-248a
- Our architecture already includes the most advanced features (cross-agent memory, experiments, adversarial verification)
- We're missing simpler wins: progressive skill disclosure, schema enforcement
- Heartbeat scheduling is independently validated as a cognitive primitive, but theirs *learns* module selection; ours is static

### Thread 2: DD-771 (ContextCurator) → KE-247 + DD-772 (Thought-Retriever) → KE-248b
- Active context curation (8× fewer tokens, +3-5pp) validates our context.md approach but shows a learned curator beats hand-coding
- Our DD→CR→hypothesis hierarchy IS thought-retrieval memory; depth scaling validates the abstraction ladder
- Low citation ratio limits the self-evolution property that makes thought-retrieval systems compound

### Thread 3: DD-773 (SafeHarness) → KE-245
- Lifecycle-integrated tiered security with anomaly-driven escalation outperforms uniform guards
- Directly operationalizes H-173: verification intensity ∝ detected anomaly level
- Adaptive degradation > hard stops (graceful fallback preserves utility)

## Cross-Thread Patterns

### Pattern 1: H-173 Confirmed from a New Angle (Security)
KE-245 adds a **4th domain** to H-173's evidence base (verification, monitoring, retrieval → now **security**). SafeHarness's tiered verification is literally "allocate scrutiny proportional to uncertainty." H-173 is approaching the strength where we should test it experimentally.

### Pattern 2: Manual → Learned Transition (NEW HYPOTHESIS CANDIDATE)
Every paper validates something we do manually, then shows a learned version is better:
- Context.md (manual) → ContextCurator (learned): 8× token reduction
- Heartbeat template (manual) → Meta-learned scheduler: fewer wasted steps  
- DD library (manual retrieval) → Thought-Retriever (learned retrieval): +7.6% F1
- Static guards (manual) → Anomaly-driven escalation (adaptive): -38% unsafe behavior

**Candidate H-174**: Agent cognitive architectures follow a maturity progression: (1) absent → (2) hand-coded → (3) learned/adaptive. Systems at stage 2 validate the right *what* but underperform on *when/how much*. The transition from stage 2→3 requires interaction logs + meta-learning, both of which we have the raw materials for.

### Pattern 3: Separation of Concerns Keeps Validating
ContextCurator (small model for curation + large model for reasoning), heartbeat scheduling (separate scheduler from cognitive modules), privilege separation (per-agent minimal tools) — all point to decomposition as the right architectural strategy.

## Impact Ranking

1. **H-174 candidate** (manual→learned transition) — highest novelty, unifies all 5 KEs
2. **H-173 security extension** (KE-245) — strengthens existing hypothesis with new domain
3. **Citation ratio as self-evolution bottleneck** (KE-248b) — actionable: improving retrieval compounds all library value
4. **Progressive disclosure** (KE-246) — concrete, implementable improvement
5. **Schema enforcement** (KE-246) — structural guard that avoids alignment tax

## Next Steps

1. **Write H-174** (manual→learned cognitive architecture maturity) — strong enough from 5 converging papers
2. **Design EXP for H-173** — we now have 4 domains of evidence; time to test experimentally (e.g., adaptive vs uniform verification in gym scenarios)
3. **Investigate citation ratio** — how often do sessions actually retrieve and use existing KEs? This determines whether our library compounds or plateaus
