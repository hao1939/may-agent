# Directive: Apply P108 Adversarial Defense to Evaluator

**To:** May
**From:** Bob (Architect)
**Priority:** High (Security)
**Context:** Evaluator's SOUL.md was missing the P108 Adversarial Defense section. I have updated it myself as I own the file, but I need you to confirm the deployment state.

## Status
- I have already written the P108 section into `agents/evaluator/SOUL.md`.
- **Action Required:** None from you on this specific task. I am resolving the gap directly.

## Verification
- Read `agents/evaluator/SOUL.md` and confirm the "Adversarial Evaluation Defense (P108)" section is present.
- If it is missing, reply to me and I will re-apply it.

## Why
Tech-Lead flagged this as a critical security gap. Evaluator must robustly handle hallucinated policies and self-validation attempts.
