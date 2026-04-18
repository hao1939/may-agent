# Synthesis: Verification and Trust in Multi-Agent Systems

**Date**: 2026-04-18  
**Sources**: KE-250 (DD-777), KE-251 (DD-778), KE-252 (DD-779)

## Summary

Three papers converge on a single architectural insight: **verification in multi-agent systems must be structural, bounded, and conflict-directed — never reasoning-based, exhaustive, or self-referential.**

## Key Findings by Source

| KE | Core Claim | Confidence |
|----|-----------|------------|
| KE-250 | Concentrate verification on disagreement hotspots, not uniform coverage | Medium-High |
| KE-251 | Observation-action gaps enable attack chains; self-verification fails because reasoning itself is compromised | High |
| KE-252 | Structured auditable artifacts + probabilistic spot-checking prevent coordination collapse | Medium-High |

## Three Convergent Themes

### 1. Self-verification is fundamentally insufficient (KE-251 + KE-250)

KE-251 shows agents' own reasoning can be hijacked — they rationalize unexpected states rather than flagging them (parallels our FM-3.3 confabulation pattern). KE-250's CAMV works precisely because it uses *external* conflict detection rather than asking agents to verify themselves. **Implication**: Any verification gate that relies on the same reasoning pipeline it's checking is security theater.

### 2. Structure makes verification tractable (KE-252 + KE-250)

KE-252 proves that without structured artifacts, receivers reject conservatively and coordination collapses. KE-250's TRSF shows the mechanism: source-traced structured facts become the shared anchor that prevents circular verification. **Implication**: Our deep-dive format (star ratings, explicit claims, structured sections) isn't cosmetic — it's the coordination primitive that makes selective verification possible.

### 3. Verification effort should be proportional, not uniform (KE-250 + KE-252)

KE-250: verify where agents disagree. KE-252: audit more on ambiguous claims, less on clear-cut ones. Both reject exhaustive verification as wasteful and unbounded. **Implication**: Our current uniform-effort review is suboptimal. Bob should spend more time where Scout's confidence is low or where findings contradict existing hypotheses.

## Contradiction / Tension

KE-251 reveals a deep paradox: **agent robustness inversely correlates with attack resistance**. More capable recovery → more exploitable recovery. This tensions with KE-252's trust-building through track record — a high-track-record agent is also one whose recovery patterns are most predictable to an attacker.

## Ranked by Impact/Novelty

1. **Structure as coordination primitive** (KE-252) — Most actionable for us immediately; validates and sharpens existing practices
2. **Self-verification insufficiency** (KE-251) — Highest theoretical impact; challenges our guard/checkpoint approach
3. **Conflict-directed verification** (KE-250) — Strongest empirical backing (GAIA SOTA); clear efficiency principle

## Proposed Next Steps

1. **H-next: Conflict-proportional verification improves Bob's review efficiency** — Test whether flagging Scout disagreements or low-confidence claims and directing Bob's attention there improves finding quality vs. uniform review
2. **Structural audit**: Map our read→reason→write cycle for action-rebinding vulnerabilities (KE-251). Where do observation-action gaps exist between agents?
3. **Per-claim confidence metadata**: Add confidence annotations to deep-dive claims (not just holistic star ratings) to enable targeted auditing per KE-252

## Meta-Pattern

All three papers point toward the same architectural shape: **independent reasoning → structured externalization → conflict/ambiguity detection → bounded targeted verification → shared grounded facts**. This is a verification pipeline, not a verification gate. Our system has pieces of this (structured KEs, independent agents) but lacks the conflict-detection and targeted-audit layers.
