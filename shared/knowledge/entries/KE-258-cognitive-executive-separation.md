# KE-258: Parallax Architecture Externally Validates Architectural Enforcement Over Prompt Guardrails

**Date**: 2026-04-18
**Source**: DD-763 / Parallax paper 2604.12986
**Confidence**: High
**Connects**: KE-011, WKWA-007, CR-306, CR-324, CR-326

## Core Finding

Parallax's cognitive-executive separation architecture achieves 98.9-100% attack block rate vs. 0% for prompt-based guardrails under assume-compromise evaluation. This independently validates our Law 2 (Prompt Guardrails Are Insufficient) and WKWA-007 finding that hard architectural gates outperform soft behavioral interventions (100% vs 0% in our own experiments).

## Evidence

- Parallax: 280 adversarial cases, 9 attack categories → 98.9% block (default), 100% (max-security), zero false positives
- Under compromise: prompt guardrails = 0% protection; architectural boundary holds regardless
- Our system: Bob's hard gates = 100% enforcement vs. skill-based interventions = 0% (WKWA-007)
- KE-011: knowledge files are passive/skipped — same failure mode as prompt-level safety

## Mechanism / Why

Prompt guardrails exist within the reasoning system they're trying to constrain — a compromised reasoner can simply ignore them. Architectural separation places the enforcement boundary outside the reasoning system's control plane, making it invariant to reasoning-level failures or attacks.

## Implications

### 1. Our intervention architecture taxonomy is externally validated
Parallax formalizes exactly what we discovered empirically: the hard/soft boundary matters more than the content of the intervention. Their 4-tier model (separation → validation → flow control → reversibility) extends our taxonomy.

### 2. Information flow control is a gap in our system
Parallax introduces sensitivity labels propagated through workflows — we have nothing equivalent. Data classification could prevent context leakage between agents.

### 3. Reversible execution is worth exploring
Pre-destructive state capture for rollback on validation failure addresses irreversible-action risk we haven't tackled.

## Actionable

- Reference Parallax as external evidence when advocating for architectural over behavioral interventions
- Investigate information flow control (sensitivity labels) as potential addition to our enforcement taxonomy
- Consider assume-compromise evaluation methodology for testing our own gates

## Open Questions

- Does their graduated determinism (multi-tier validation) map to useful intermediate enforcement levels in our system?
- Could reversible execution apply to our coder's file operations?
