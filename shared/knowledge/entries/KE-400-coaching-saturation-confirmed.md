# KE-400: Coaching Notification Saturation — Repeated Text Coaching Doesn't Improve Compliance

**Date**: 2026-06-23
**Source**: EXP-231, H-EXP-030, EXP-215
**Confidence**: High
**Connects**: KE-002, KE-123, H-EXP-029, H-EXP-030

## Core Finding

Repeated coaching notifications do not improve compliance; volume is uncorrelated with behavior change. QA received 9+ coaching notifications for C1.4/C8.2 in 48h with zero compliance improvement (C1.4: 42% compliance, 22 violations).

## Evidence

- QA C1.4 violations: 22 total despite being the most coached convention
- QA C8.2 violations: 17 total despite extensive coaching
- EXP-215: text-based instructions have ~0% compliance for structural behaviors
- H-EXP-029 (validated): effectiveness hierarchy is structural > role context > skills > notifications
- QA sessions with 9 inbox notifications show low opCounts (7-10), suggesting dismissal rather than engagement

## Mechanism / Why

Structural behaviors (calling finish(), including required fields) require structural enforcement. Text coaching — whether in context.md, skills, or inbox notifications — doesn't change the underlying execution pattern. Increasing notification volume degrades inbox signal-to-noise ratio, potentially causing agents to dismiss ALL notifications including actionable ones.

## Implications

### 1. Notification rate-limiting needed
Max 1 coaching notification per convention per 48h. Additional notifications add noise without signal.

### 2. Structural enforcement > text coaching
For compliance problems, invest in workflow/harness-level enforcement rather than notification-based coaching.

## Actionable

- Stop sending repeated coaching notifications for C1.4/C8.2 — they don't work
- Implement rate-limiting: max 1 notification per convention per 48h
- For persistent violations, design structural enforcement (e.g., session wrappers)
- Coach agent should check this KE before sending coaching notifications

## Open Questions

- Does rate-limiting coaching improve engagement with non-coaching notifications?
- What's the minimum structural enforcement needed to fix C1.4? (workflow gate vs wrapper)
