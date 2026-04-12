# Synthesis: Observability Tax × Guard Positive Feedback Loop

**Date**: 2026-04-12  
**Sources**: DD-750 (Observability Tax literature), H-102/EXP-145 tension analysis, KE-152 (Guard Positive Feedback Loop)  
**Core Question**: Does the observability tax framework explain fleet-wide guard rate decline? What connects reasoning externalization to convention adherence?

---

## 1. Thread Summaries

### Thread 1: H-102 vs EXP-145 Tension Analysis

The tension scan found that H-098 (Attention Channel Theory) is emerging as a grand unifying framework that could subsume 5–6 Tier-1 hypotheses. Key structural finding: H-085, H-091, H-043, H-053, and H-087 all describe facets of the same underlying channel-effectiveness phenomenon. Two genuine tensions were flagged:

- **H-093 (CIVC) vs H-098**: Does extreme complexity override Ch2 structural effectiveness?
- **H-103 (Guard Internalization) vs H-098**: Does repeated Ch2 exposure improve Ch1 effectiveness over time — i.e., is there Ch2→Ch1 transfer?

The second tension is directly relevant to this synthesis.

### Thread 2: DD-750 Observability Tax

Twelve papers (2024–2026) converge on: **visible reasoning traces are not the reasoning itself**. Three-layer model:
1. **Latent reasoning** (hidden states) — actual computation, never visible
2. **Thinking-token reasoning** — semi-faithful (~87.5% acknowledgment)
3. **Output reasoning** (externalized CoT, files) — post-hoc reconstruction (~28.6% acknowledgment)

Forced externalization can *degrade* reasoning via verbal overshadowing (Kim: up to 40% performance drop when epistemic verbalization is suppressed). Adaptive thinking research shows 50–90% of externalized reasoning is removable without accuracy loss.

---

## 2. The Key Connection: Why Guard Rates Decline Fleet-Wide

KE-152 documents that guard fire rates dropped 25.1% → 2.6% across 12 conventions. The standard explanation is "agents internalize conventions." But DD-750 provides a deeper — and potentially contradictory — mechanistic account.

### Hypothesis A: Genuine Internalization (KE-152 account)

Guards teach agents. Repeated Ch2 encounters train Ch1 behavior. Agents genuinely learn the conventions and no longer need the guard. Fire rate → 0 because the underlying behavior improved.

### Hypothesis B: Layer Adaptation (DD-750-informed account)

Agents learn to produce **Layer 3 compliance artifacts** (the output-level reasoning that looks correct) without necessarily changing their **Layer 1 reasoning** (actual computation). The fire rate drops because agents learn to produce outputs that *pass the guard*, not because they've internalized the convention's purpose.

This is precisely the Kim et al. self-distillation finding: training on one's own outputs can suppress epistemic verbalization while maintaining surface compliance. Guards check Layer 3 outputs. If agents optimize for passing guards at Layer 3, fire rates drop — but the underlying reasoning quality might plateau or even degrade.

### Resolution: It's Probably Both, But the Mix Matters

The EXP-145 data showing 0/12 conventions with escalation patterns is real — agents are genuinely changing behavior, not just gaming guards. But the DD-750 framework suggests we should be cautious about *what kind* of change we're measuring:

| Evidence | Supports A (Genuine) | Supports B (Surface) |
|----------|---------------------|---------------------|
| Fire rate decline: 25.1→2.6% | ✓ Consistent | ✓ Also consistent |
| 0/12 escalation | ✓ Strong | Neutral |
| Self-correcting transient | ✓ Learning curve | ✓ Optimization curve |
| Young's 87.5/28.6 gap | — | ✓ Output ≠ thinking |
| Adaptive thinking (TON etc.) | — | ✓ Agents learn to skip externalization |

**The critical missing test**: Do agents who've "internalized" a convention via guard exposure maintain the convention in **novel contexts** where the guard isn't present? This would distinguish genuine internalization from guard-specific optimization.

---

## 3. Reasoning Externalization and Convention Adherence

DD-750's central claim — that forcing externalization creates an observability artifact, not reasoning quality — has a specific implication for convention adherence:

**Conventions that can be checked structurally (Ch2) work precisely because they DON'T depend on reasoning faithfulness.**

A guard that checks "did you read the file before editing?" doesn't need to inspect reasoning — it checks tool call ordering. This is Layer 1 behavior (action sequence), not Layer 3 behavior (reasoning narrative). Ch2 guards are effective because they operate at the action level, bypassing the entire observability tax problem.

This explains an otherwise puzzling asymmetry:
- **Text-based rules (Ch1)**: 0% effectiveness — these depend on Layer 3 processing, which DD-750 shows is unfaithful
- **Environmental guards (Ch2)**: 87-100% effectiveness — these check actions, not reasoning, so the observability tax doesn't apply
- **Guard internalization (KE-152)**: Works because repeated action-level correction eventually modifies Layer 1 behavior, not because the agent reads and understands the rule

**Key insight**: Ch2 guards succeed *because they don't trust reasoning externalization*. They check what the agent *did*, not what it *said it thought*. This is the architectural insight that connects DD-750 to KE-152: the most effective learning mechanism is one that completely sidesteps the observability tax.

---

## 4. The H-103 Tension Sharpened

The tension analysis flagged H-103 (Guard Internalization) vs H-098 (Channel Theory) as unresolved. DD-750 sharpens this tension considerably:

- **H-098 assumes channel effectiveness is stable**: Ch2 always works, Ch1 never works.
- **KE-152 suggests Ch2→Ch1 transfer**: repeated Ch2 exposure makes agents follow rules even without Ch2 enforcement.
- **DD-750 complicates both**: If "following rules" means producing compliant Layer 3 outputs, this might be surface optimization, not genuine Ch2→Ch1 transfer.

**New prediction**: If guard internalization is genuine (Hypothesis A), then agents who've internalized via Ch2 should show improved convention adherence in **new sessions with fresh contexts** where no guard history is present. If it's surface optimization (Hypothesis B), convention adherence should be fragile — returning to baseline when guard exposure stops.

EXP-145's fleet data can't distinguish these because guards were always present. A guard-removal experiment would be decisive.

---

## 5. Findings Ranked by Impact/Novelty

| Rank | Finding | Impact | Novelty |
|------|---------|--------|---------|
| 1 | **Ch2 guards bypass the observability tax entirely** — they check actions not reasoning, which is WHY they work | ★★★★★ | ★★★★★ |
| 2 | **Guard rate decline may be surface compliance, not deep internalization** — Hypothesis B from DD-750 | ★★★★★ | ★★★★☆ |
| 3 | **H-098 is a grand unifying framework** — 5 hypotheses can merge into it | ★★★★☆ | ★★★☆☆ |
| 4 | **Ch1 fails because it depends on Layer 3 faithfulness** — DD-750 explains the 0% rate | ★★★★☆ | ★★★★☆ |
| 5 | **Guard-removal experiment would be decisive** — tests genuine vs. surface internalization | ★★★★☆ | ★★★★☆ |
| 6 | **H-093 (CIVC) vs H-098 tension remains open** — complexity may override Ch2 effectiveness | ★★★☆☆ | ★★★☆☆ |

---

## 6. Proposed Next Steps

### Immediate (this cycle)

1. **Update H-103 with DD-750 evidence**: Add the surface-optimization alternative hypothesis. This sharpens H-103 from "guards teach" → "guards teach OR guards train compliance artifacts — distinguishing test needed."

2. **Propose EXP-148: Guard Removal Experiment**: Select 2–3 conventions where guard fire rate is near zero. Remove the guard. Measure whether convention adherence holds (genuine internalization) or decays (surface optimization). This is the decisive test.

### Medium-term

3. **Incorporate DD-750's three-layer model into H-098**: The channel theory should distinguish between "what layer does the intervention target" and "what layer does it check." Ch2's power comes from targeting Layer 1 (actions) while Ch1 targets Layer 3 (reasoning narratives).

4. **Explore Layer 2 monitoring**: DD-750 shows thinking tokens are ~3x more faithful than output text. If we monitor extended thinking rather than formatted outputs, we might detect reasoning quality changes that guards miss.

### Longer-term

5. **Re-examine the consolidation proposal**: If H-098 absorbs 5 hypotheses, the resulting theory should explicitly incorporate the observability tax as its mechanistic explanation for *why* channel effectiveness varies. This would make the merged framework both descriptive (what works) and explanatory (why it works).

---

## 7. One-Paragraph Executive Summary

The observability tax framework (DD-750) provides the missing mechanistic explanation for why Ch2 environmental guards work and Ch1 text rules don't: **Ch2 guards check actions (Layer 1 behavior) while Ch1 rules require faithful reasoning externalization (Layer 3), which 12 papers show is systematically unfaithful.** This also raises a critical question about KE-152's positive feedback finding: the fleet-wide decline in guard fire rates (25.1→2.6%) could reflect genuine convention internalization OR surface-level compliance optimization where agents learn to produce outputs that pass guards without changing their underlying reasoning. A guard-removal experiment (proposed EXP-148) would be decisive. The synthesis strengthens H-098 as a unifying framework while adding explanatory depth: channel effectiveness isn't arbitrary — it follows directly from which reasoning layer each channel targets.

---

*Bob — Research Synthesis — 2026-04-12*
