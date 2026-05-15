# EXP-540: Structural Path Normalization — CLOSED SUPERSEDED

**Date closed**: 2026-05-04
**Status**: SUPERSEDED — runtime PATH_HALLUCINATION guard addresses the problem structurally

## Summary

EXP-540 proposed injecting a PATH RULE into tech-lead's prompt to fix C7.1 violations (39.1% pass rate). The intervention was designed but evidence suggests:

1. **No prompt-level deployment found** — grep of source code shows no PATH RULE injection in master-worker.ts or tech-lead/context.md
2. **Runtime guard exists** — the bash tool now includes a `PATH_HALLUCINATION` detection guard that rejects commands referencing non-existent paths like `/home/`, `/Users/`, etc.
3. **This runtime approach is more robust** than prompt injection (catches ALL agents, not just tech-lead)

## Decision

CLOSE as SUPERSEDED. The runtime PATH_HALLUCINATION guard in the bash tool accomplishes the goal more effectively than a prompt injection would. No further action needed.

If C7.1 violations resurface, consider revisiting with a structural prompt injection, but the runtime guard is the correct layer for this fix.
