# DD#846 — Explicit Trait Inference for Multi-Agent Coordination

**Paper:** 2604.19278 — Abdurahman, Ishii, Margatina, Bhargavi, Sunkara, Zhang (cross-list cs.AI→cs.MA)
**Rating:** ★★★★
**Date:** 2026-04-23 triage

## One-Line
LLM agents that explicitly infer partner warmth/competence traits from interaction history reduce coordination failures by 45-77% in economic games and 3-29% in complex MAS benchmarks.

## Key Findings

1. **Two-dimensional trait inference.** Agents infer partner characteristics along warmth (trust, cooperativeness) and competence (skill, reliability) — established psychological dimensions. Traits are updated from interaction history.

2. **Trait profiles predict actions.** The inferred profiles actually correlate with agent behaviors, validating that the inference is capturing real signal, not just noise.

3. **Lightweight mechanism.** ETI is a prompting/memory overlay, not architectural — can be added to existing MAS with minimal overhead.

4. **First systematic evidence** that LLM agents can (i) reliably infer others' traits from interaction and (ii) use structured awareness for coordination.

## Why This Matters

### For EXP-099 (Cascade Archetypes)
Trait inference enables **cascade-aware coordination**. If an agent can track partner competence, it can route critical decisions away from unreliable partners — reducing cascade initiation probability. Warmth tracking enables detection of adversarial or non-cooperative agents.

### For CR#320/CR#345 (Behavioral Failure Detection)
Competence tracking IS behavioral failure detection at the agent level. If Agent A's inferred competence of Agent B drops across interactions, that's a behavioral failure signal. This is peer-based behavioral monitoring, complementary to external monitors.

### For DD-842 (Illusory Coordination)
ETI could be a partial solution to illusory coordination — if agents track whether partners are actually contributing (competence) vs just going through the motions (warmth without competence).

## Limitations
- Economic games are stylized; complex MAS gains are modest (3-29%)
- Two dimensions may be insufficient for production systems
- No adversarial evaluation (what if agents game their trait signals?)
