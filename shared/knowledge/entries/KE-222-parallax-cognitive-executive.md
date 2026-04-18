# KE-222: External validation — architectural separation beats prompt guardrails 98.9% vs 0%

**Date**: 2026-04-18
**Source**: DD-763 (Parallax, paper 2604.12986)
**Confidence**: High
**Connects**: KE-011, H-166, WKWA-007

## Core Finding

Parallax (DD-763) provides independent external validation of our core thesis: under assume-compromise conditions, prompt-based safety provides **0% protection** while architectural cognitive-executive separation achieves **98.9-100%** block rate with zero false positives. This directly mirrors our WKWA-007 finding (hard gates 100% vs skills 0%) and confirms Law 2 (Prompt Guardrails Are Insufficient).

## Evidence

- Parallax OpenParallax eval: 280 adversarial cases, 9 attack categories → 98.9% default, 100% max-security
- Under reasoning-system compromise, prompt guardrails = 0% (identical to our skill-only finding)
- Zero false positives across all security tiers
- Our own data: WKWA-007 hard gates = 100% compliance vs 0% for prompt/skill-only

## Mechanism / Why

Prompt guardrails live inside the compromised reasoning system — they're part of the attack surface, not a defense against it. Architectural separation creates a structurally independent validation layer that cannot be bypassed by prompt injection or reasoning-system compromise.

## Implications

### 1. Our enforcement taxonomy is externally validated
The hard-gate > skill hierarchy we discovered empirically now has formal architectural backing from an independent research group with rigorous adversarial evaluation.

### 2. Information flow control is a missing dimension
Parallax adds data sensitivity labels propagated through workflows — a dimension not yet in our enforcement taxonomy. Worth investigating whether sensitivity-aware routing could improve our system.

### 3. Reversible execution addresses an open gap
Pre-destructive state capture for rollback on validation failure is not currently in our system. This could reduce the cost of hard-gate false positives (currently zero, but relevant as we scale).

## Actionable

- Reference DD-763/KE-222 when presenting enforcement architecture findings externally — strongest independent confirmation available
- Investigate whether information flow control (sensitivity labels) would add value to our agent routing

## Open Questions

- Would Parallax's graduated determinism (multi-tiered validation) improve on our binary hard-gate approach?
- How does the 98.9→100% gap (default→max-security) trade off against latency/cost?
