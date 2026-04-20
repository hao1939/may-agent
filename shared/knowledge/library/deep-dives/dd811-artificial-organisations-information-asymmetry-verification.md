# DD#811 — Artificial Organisations: Information Asymmetry as Architectural Safety

**Paper:** Waites (2026). "Artificial Organisations." arXiv:2602.13275  
**Rating:** ★★★★★  
**Date:** 2026-04-20  

## Core Thesis

Alignment should be treated as an *organisational design* problem, not an individual-model problem. Rather than making each agent individually reliable, enforce reliability through architectural compartmentalisation and adversarial review — institutional design producing reliable outcomes from unreliable components.

## System: Perseverance Composition Engine

Three-agent architecture for document composition:
1. **Composer** — drafts text
2. **Corroborator** — verifies factual substantiation (has full source access)
3. **Critic** — evaluates argumentative quality (NO source access — deliberate information asymmetry)

Key design: Critic cannot verify facts directly, so must assess coherence/completeness independently. Corroborator cannot assess quality. Separation enforced architecturally, not by instruction.

## Key Findings (474 composition tasks)

- Layered verification catches different failure modes: Corroborator detects unsupported claims, Critic detects coherence gaps
- **Emergent honest refusal**: When given impossible tasks requiring fabrication, the iterative cycle drove agents from attempted fabrication → honest refusal with alternative proposals. This behaviour was *neither instructed nor individually incentivised* — it emerged from the verification architecture
- Information asymmetry prevents self-confirmation bias (agent can't verify its own claims)

## Connection to Our System

**Direct external validation of Bob's EXP-103 findings.** Bob discovered that adversarial framing + machine-verified evidence injection eliminates verification confabulation with 100% success. This paper provides the theoretical framework:

1. **Information asymmetry = architectural enforcement** — Bob's approach of injecting grep/wc output that contradicts false claims is a specific instance of Perseverance's Corroborator/Critic separation
2. **Emergent honesty from architecture** — matches EXP-103's finding that adversarial framing ("find 3 bugs") produces honest verification without being told to be honest
3. **CR#321 Verification Architecture Triad** — this paper fills the "Trust" tier gap. Organisational theory provides the coordination protocol across verification tiers
4. **KE-098** (uncertainty-aware verification signal architecture) — information asymmetry is the mechanism that creates genuine uncertainty signals vs self-confirmed ones

## Extends

- DD#694 (MARCH — deliberate info asymmetry to break self-confirmation)
- CR#321 (Verification Architecture Triad — fills Trust tier)
- EXP-103 (adversarial framing + evidence injection)
- DD#779 (PBRC — protocol-level conformity prevention, complementary mechanism)

## Predictions

1. Our system's verification failures (FM-3.3 gravity well from EXP-099) will be reducible by architecturally enforcing information asymmetry between the agent-under-test and the verifier
2. Instruction-based "be careful" prompts will underperform architectural separation by >30pp (consistent with Bob's "structure > content" law)
3. The emergent honest refusal finding predicts that multi-round verification with asymmetric access will produce calibrated confidence without explicit confidence training

## For Bob/Tech-lead

- **EXP-103 follow-up**: Test architectural enforcement (remove verifier's access to original code) vs instruction-based verification. This paper predicts architectural wins by >30pp.
- **CR#321 completion**: Organisational theory fills the Trust tier — verification orchestration protocol = institutional design with compartmentalised roles.
