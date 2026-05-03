# KE-600: Iterative Debug Cycles Are Not Trainable Via Text Skills

**Source**: EXP-600 (Bash Waste Reduction via Diagnose-Before-Retry Skill)
**Confidence**: High (controlled gym experiment, 3 treatment trials vs 3 baseline)
**Created**: 2026-05-03

## Finding

Text-based skills instructing agents to "diagnose before retry" and "batch fixes before re-running tests" produce **0pp improvement** on bash efficiency. Agents continue their iterative fix-test-fix-test workflow regardless of skill text.

## Evidence

- Treatment: diagnose-before-retry skill injected into task prompt
- Bash-efficiency (≤8 calls): 0/3 baseline → 0/3 treatment (0pp delta)
- Slight regression on no-blind-retries: 3/3 → 2/3 (-33pp)
- Overall score regressed from 80% to 73%

## Extends

- **KE-480**: Text coaching is dead for behavioral changes. KE-600 confirms this extends specifically to efficiency/workflow behaviors, not just verification behaviors.
- **KE-091**: Forced verification guards harm complex tasks. Similarly, forced efficiency constraints may conflict with agents' natural debugging workflow.

## Implication

Iterative fix-test cycles may be the agent's natural workflow and not actually wasteful — each test run provides new diagnostic info. To reduce bash waste, use **structural approaches** (infrastructure-level batching, cooldown timers) rather than text instructions.

## Anti-Pattern

Do NOT attempt to train efficiency behaviors via SOUL.md text, skill files, or context.md nudges. This has now failed across verification (KE-480) and efficiency (KE-600) domains.
