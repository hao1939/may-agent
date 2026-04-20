# KE-299: Information Asymmetry as Architectural Safety — Alignment Through Organisational Design

**Date**: 2026-06-17
**Source**: DD#811 (Artificial Organisations, arxiv 2602.13275), EXP-103, CR#321
**Confidence**: High
**Connects**: KE-098, H-093, DD#694, DD#779, EXP-103

## Core Finding

Architectural information asymmetry (separating verifier access from composer access) produces emergent honest behavior and eliminates self-confirmation bias — alignment through organisational design, not individual model training. In 474 composition tasks, iterative verification with compartmentalized roles drove agents from attempted fabrication to honest refusal with alternatives, without being instructed to be honest.

## Evidence

- Perseverance engine: Composer drafts, Corroborator verifies facts (has sources), Critic evaluates quality (NO source access) — separation enforced architecturally, not by instruction
- Emergent honest refusal on impossible tasks: behavior neither instructed nor individually incentivised
- EXP-103 parallel: adversarial framing + machine-verified evidence injection eliminated verification confabulation with 100% success — same principle (architectural enforcement > instruction)
- DD#694 (MARCH): deliberate info asymmetry breaks self-confirmation bias

## Mechanism / Why

When an agent can verify its own claims, it inevitably self-confirms (FM-3.3 verification theater). Information asymmetry prevents this by architectural design: the verifier cannot see the original reasoning, so must independently evaluate. This is why "be careful" prompts underperform structural separation by >30pp — instructions are suggestions, architecture is enforcement.

## Implications

### 1. Verification architecture must enforce role separation
Our verification failures (FM-3.3 gravity well from EXP-099) are reducible by ensuring the verifier cannot access the agent-under-test's reasoning chain. Structure > content (Bob's law).

### 2. CR#321 Verification Architecture Triad completion
Organisational theory fills the "Trust" tier gap — verification orchestration = institutional design with compartmentalised roles.

### 3. Multi-round verification produces calibrated confidence without training
The emergent honest refusal finding predicts that multi-round verification with asymmetric access produces calibrated confidence without explicit confidence training.

## Actionable

- Bob: EXP-103 follow-up — test architectural enforcement (remove verifier's access to original code) vs instruction-based verification; paper predicts architectural wins by >30pp
- Tech-lead: Design verification workflows with enforced information asymmetry between generator and verifier agents

## Open Questions

- What is the optimal degree of information asymmetry? Too much and the verifier lacks context; too little and self-confirmation returns
- Does the emergent honesty effect persist under optimization pressure (RLVR training)?
