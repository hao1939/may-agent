# Citation Synthesis: Context Authority as Dual-Use Mechanism

**Date**: 2026-04-21
**Sources**: CR-335, CR-338, CR-293, KE-122, KE-123, KE-134

## Pattern

Three scout-flagged citations (CR-335, CR-338, CR-293) converge on a single meta-pattern: **the mechanisms that make agents capable also make them fragile — and the lever is context authority**.

### The Dual-Use Mechanism

CR-335's Error Propagation Lifecycle identifies that agents treat inherited context as more authoritative than in-session reasoning (Phase 4: Amplification). This mechanism is **neutral** — it amplifies whatever is committed to persistent state:

| Committed Content | Outcome | Evidence |
|---|---|---|
| Correct behaviors (skills, KEs) | **Positive internalization** — intervention decay (KE-122) | EXP-116/118: 100% baselines |
| Errors/confabulations | **Error entrenchment** — inherited confabulation | CR-335: Session 599 cascade |
| Multiple interventions | **Over-constraining** — iatrogenesis (KE-123) | EXP-116 Arms C/D: -12pp/-15pp |
| Format instructions (gates) | **Capacity exhaustion** — structure snowballing | CR-338/KE-134: 4-gate = 67% |

### The Unifying Principle

Every item committed to an agent's context claims a share of its cognitive budget (CR-338's "format tax") and is treated as authoritative (CR-335's "amplification"). This means:

1. **Good things internalize fast** (KE-122) — but become hard to override if wrong
2. **Bad things entrench fast** (CR-335) — and gain false legitimacy through repetition  
3. **Interventions interact superadditively** (KE-123) — because each claims authority and budget
4. **Gates have an optimal count** (KE-134) — because scaffolding benefit saturates but format tax doesn't

### Implication for System Design

The optimal agent context is **minimal and high-signal**. Every additional instruction, guard, or knowledge entry has both benefit (scaffolding/guidance) and cost (authority claim on cognitive budget). The hump curve (KE-134) is the canonical example: benefit peaks then cost dominates.

This connects to CR-293's read:edit ratio as a health metric — when context authority is well-calibrated, agents read more (respecting context) and edit carefully. When overwhelmed, they skip reading (avoiding context overload) and edit blindly.

## Confidence Impact

No hypothesis confidence changes warranted. H-163 already incorporated recent evidence (P(H) = 0.68). The new citations strengthen *mechanistic understanding* of existing findings without changing directional confidence.

## Citations Added This Session

| Target | Citation | What It Adds |
|---|---|---|
| KE-122 | CR-335 | External literature grounding for internalization mechanism via context authority |
| KE-123 | CR-335 | Amplification phase explains superadditive harm of combined interventions |
| KE-134 | CR-338 | Mechanistic explanation (scaffolding vs format tax) for hump curve |
