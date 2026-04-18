# KE-239: Cognitive-Executive Separation Provides 98.9-100% Safety vs 0% for Prompt Guardrails

**Date**: 2026-04-18
**Source**: DD-763 (Parallax, 2604.12986)
**Confidence**: High
**Connects**: KE-011, WKWA-007, CR-306, CR-324

## Core Finding

Architectural safety boundaries (cognitive-executive separation) provide 98.9-100% protection under assume-compromise eval vs 0% for prompt guardrails — strongest external validation of Law 2 (Prompt Guardrails Are Insufficient).

## Evidence

- Parallax OpenParallax implementation: 280 adversarial cases, 9 attack categories
- Default config: 98.9% block rate. Max-security: 100%. Zero false positives
- When reasoning system is compromised, prompt guardrails provide **zero** protection
- Our own WKWA-007 data: hard gates 100% vs skills 0% — same pattern at different scale

## Mechanism / Why

Prompt guardrails exist within the compromised system — they're data, not structure. An adversary that controls reasoning can simply ignore or rewrite prompt instructions. Architectural separation creates a boundary the reasoning system *cannot cross* regardless of intent, because execution requires passing through an independent validator.

## Implications

### 1. Our enforcement taxonomy needs an "information flow control" tier
Parallax adds sensitivity labels propagated through workflows — a dimension we haven't explored. Data classification could prevent context leakage between agent sessions.

### 2. Assume-Compromise Evaluation is the right adversarial methodology
Testing by bypassing the reasoning system entirely (not just adversarial prompts) is the only way to validate architectural boundaries. Maps to CR-326 Path A production-first eval.

### 3. Reversible execution addresses our irreversible-action gap
Pre-destructive state capture + rollback on validation failure is a practical pattern we could adopt for high-risk agent operations.

## Actionable

- Reference Parallax as external validation when arguing for architectural enforcement over prompt-based safety
- Consider adding information flow control (sensitivity labels) to our intervention architecture taxonomy
- Evaluate Assume-Compromise methodology for our own guard/gate testing

## Open Questions

- How much latency does the cognitive-executive boundary add? Is it acceptable for real-time agent workflows?
- Can the graduated determinism (multi-tier validation) be simplified for our use case?
