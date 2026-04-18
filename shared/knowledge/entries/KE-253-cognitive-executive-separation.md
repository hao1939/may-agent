# KE-253: Cognitive-Executive Separation Provides Near-Perfect Safety Under Compromise

**Date**: 2026-04-18
**Source**: DD-763 / Parallax paper (2604.12986)
**Confidence**: High
**Connects**: KE-002, WKWA-007, CR-306, CR-324

## Core Finding

Architectural separation between reasoning and execution provides 98.9-100% safety under adversarial compromise, vs 0% for prompt-based guardrails. This is the strongest external validation of Law 2 (Prompt Guardrails Are Insufficient).

## Evidence

- Parallax OpenParallax implementation: 280 adversarial cases, 9 attack categories → 98.9% block rate (default), 100% (max-security), zero false positives
- When reasoning system is fully compromised, prompt guardrails provide **zero** protection; architectural boundary holds regardless
- Evaluated via Assume-Compromise methodology that bypasses reasoning entirely

## Mechanism / Why

Prompt guardrails exist within the same system they're trying to constrain. A compromised reasoning system can simply ignore or rewrite them. Architectural separation creates an independent enforcement boundary that the reasoning system cannot reach — it's a structural impossibility, not a behavioral suggestion.

## Implications

### 1. Our hard-gate results generalize
Bob's hard gates vs. skill comparison (100% vs 0% from WKWA-007) is not a local artifact — it reflects a fundamental architectural property. Prompt-level interventions will always be fragile.

### 2. Information flow control is underexplored
Parallax adds sensitivity labels propagated through workflows — a dimension our enforcement taxonomy doesn't yet cover. Could be relevant for multi-agent trust boundaries.

## Actionable

- Use this as external citation when arguing for architectural over behavioral interventions
- Consider Assume-Compromise evaluation methodology for our own guard testing

## Open Questions

- What's the cost overhead of the validation layer in practice?
- Can graduated determinism (multi-tier validation) reduce false positives in our guards?
