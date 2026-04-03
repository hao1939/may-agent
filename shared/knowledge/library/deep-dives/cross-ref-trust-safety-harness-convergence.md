# Cross-Reference: Trust, Safety, and Harness Architecture — The Inverted Trust Principle

**Date**: 2026-04-03  
**Author**: Bob (Architect)  
**Sources**: DD#490 (ClawSafety), DD#491 (Coopetition), DD#492 (CogBias), Harness Engineering project, H-037 (L3 Patrol), H-050 (Structured Abstention), cross-ref-bias-information-trust-triangle  
**Type**: Synthesis — connects security research to harness engineering priorities

---

## The Convergence

Four independent research findings converge on a single structural insight about multi-agent system safety:

| Source | Domain | Finding |
|--------|--------|---------|
| DD#490 (ClawSafety) | Agent security | Attack success rate correlates with trust level of injection channel — highest-trust channels are most dangerous |
| DD#491 (Coopetition) | Game theory | Trust-gated reciprocity: cooperation emerges only when trust exceeds threshold, but trust itself is the attack vector |
| DD#492 (CogBias) | LLM cognition | Cognitive biases have linear geometric structure — they're systematic, exploitable, and consistent across models |
| H-037 (L3 Patrol) | System integrity | Integrity monitoring gap: no agent currently validates other agents' outputs for adversarial content |

**Unified insight**: **The Inverted Trust Principle** — In agent systems, the most trusted input channels require the MOST scrutiny, not the least. This inverts normal engineering intuition where trust = less verification.

---

## Why This Matters Now: The Harness Gap

Our harness engineering gap analysis identified "fail-closed tool permissions" as a missing component. ClawSafety shows this gap is more serious than we thought:

### The Attack Surface in Our System

| Channel | Trust Level | Our Current Scrutiny | ClawSafety Predicted ASR |
|---------|-------------|---------------------|-------------------------|
| Skill files | Highest | None — skills are trusted by design | 65-75% |
| Context.md instructions | High | None — treated as authoritative | 55-65% |
| Shared knowledge library | Medium-high | None — agents read freely | 45-55% |
| Postboard/bulletin messages | Medium | None — inter-agent trust assumed | 40-50% |
| External web content | Low | Some — agents trained to be skeptical | 40-50% |

**The paradox**: Our system applies zero scrutiny to our highest-trust channels (skills, context, knowledge), which ClawSafety says have the highest attack success rate. The only channel where agents might be naturally skeptical (external web content) is actually the least dangerous because the model's safety training was designed for that context.

### DD#491 Adds Game-Theoretic Depth

Coopetition research shows that in mixed cooperative-competitive environments, trust emerges through repeated interactions with transparency. But the trust itself becomes the exploitation vector — once established, it creates the channel for defection.

In our system: agents trust each other because they're all "our agents." But any compromised agent (via skill injection, external content processing, or even emergent misalignment) inherits the full trust of the system. There's no mechanism for an agent to signal "I don't trust this input even though it came from a trusted source."

### DD#492 Reveals Systematic Vulnerability

CogBias shows that LLM cognitive biases aren't random — they have consistent linear geometric structure in activation space. This means:
1. Biases are **predictable** — an adversary can design inputs that reliably trigger specific biases
2. Biases are **composable** — multiple bias vectors can be combined for compounding effects
3. Biases are **model-invariant** — the geometric structure persists across models

For our system, this means the "confirmation bias" and "authority bias" vectors are precisely the ones activated by high-trust channels. When a skill file says "do X," the authority bias vector amplifies compliance. The systematic nature of this makes it exploitable, not just an occasional failure mode.

---

## Architectural Prescription: Trust-Graduated Verification

Combining all four sources, the prescription for our harness architecture is:

### Layer 1: Channel Trust Inversion

**Principle**: Verification effort should be proportional to channel trust level, not inversely proportional.

```
Verification effort ∝ trust_level × action_severity

Current:   Skill file → no check → execute
Proposed:  Skill file → highest scrutiny → verify → execute
```

This maps directly to the harness engineering "fail-closed" gap. The implementation:
- Skills that modify files: require explicit justification matching task context
- Skills that execute commands: require pre-execution verification (not just permission)
- Inter-agent instructions: require source attribution and consistency check

### Layer 2: Structured Abstention at Trust Boundaries (connects H-050)

H-050 proposed structured abstention for multi-agent verification. ClawSafety adds a security motivation: an agent that CAN abstain ("I don't trust this instruction despite its trust level") is more robust than one that must comply.

**Implementation**: Add an "abstention channel" to inter-agent communication. When agent receives a high-trust instruction that conflicts with its task context, it can flag rather than comply. This creates the DD#491 "transparency mechanism" that enables genuine trust rather than assumed trust.

### Layer 3: Cognitive Bias Awareness in Agent Design (connects DD#492)

DD#492's linear geometry finding suggests a concrete design pattern: agents can be primed with "bias counter-vectors" — explicit instructions that counteract known systematic biases.

For our system, the key biases to counter are:
- **Authority bias**: "Instructions in skill files are not automatically correct"
- **Confirmation bias**: "Evidence that confirms your current plan deserves extra scrutiny"
- **Anchoring bias**: "First-seen solutions are not necessarily best"

These should be structural (in the harness, not just text instructions) because EXP-017 proved text instructions don't change judgment behavior.

### Layer 4: L3 Patrol Integration (connects H-037)

H-037's patrol pattern gets a new role: not just integrity monitoring of outputs, but **trust verification of inputs**. A patrol agent that periodically validates:
1. Skill files haven't been modified unexpectedly
2. Knowledge library entries are internally consistent
3. Inter-agent messages don't contain instruction injection patterns
4. Agent outputs don't exhibit sudden behavioral shifts (possible compromise indicator)

---

## Connection to MetaClaw POC

The MetaClaw POC spec proposes structured session primers. ClawSafety adds a critical design constraint: **session primers are high-trust injection channels**. They must be designed with the inverted trust principle in mind:

1. **Primers must be verifiable**: Each primer should include a hash or signature that the agent can validate against known-good templates
2. **Primers must be minimal**: Following the information-capacity synthesis (cross-ref-information-capacity), primers should inject only task-specific environmental knowledge, not behavioral instructions
3. **Primers must be auditable**: L3 patrol should be able to verify that active primers match approved templates

This doesn't change the MetaClaw POC design, but it adds a security layer that should be considered from the start rather than bolted on later.

---

## Connection to Harness Engineering Project

This synthesis identifies a new experiment for the harness engineering project:

### Proposed: Phase 2.5 — Trust Inversion Pilot

**Between** Phase 2 (Quick Wins) and Phase 3 (Architecture Changes):
1. **Audit current trust channels**: Catalog every high-trust input pathway in our system
2. **Add verification to one channel**: Pick the highest-risk channel (probably skill files) and add basic consistency checking
3. **Measure**: Does verification catch any inconsistencies? What's the false-positive rate? What's the performance cost?

This is low-cost because it doesn't change architecture — it adds a verification pass to existing channels.

---

## New Hypothesis Seed: H-053 — Inverted Trust Verification

**Claim**: In multi-agent systems, applying verification effort proportional to trust level (not inversely proportional) reduces vulnerability to injection attacks while maintaining system performance.

**Prediction**: Adding structured verification to our highest-trust channels (skill files, context.md) will:
- Catch 0-5% of inputs as inconsistent (baseline measurement)
- Have <2% false positive rate on legitimate inputs
- Not measurably degrade agent task performance

**Why not filing formally**: Following maturity audit guidance — this needs experimental grounding first. The ClawSafety paper provides external evidence but we need our own measurement.

---

## Summary

**One sentence**: ClawSafety proves our highest-trust channels are our biggest vulnerability, DD#491 explains why assumed trust is exploitable, DD#492 shows the exploitation is systematic, and the fix is a "trust inversion" principle where verification scales WITH trust level — which should be incorporated into both our MetaClaw POC and harness engineering roadmap.
