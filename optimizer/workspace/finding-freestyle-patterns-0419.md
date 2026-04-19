# Finding: Top Freestyle Patterns (2026-04-19)

## Method
Analyzed 30 most recent sessions in `.state/sessions/` for workflow vs freestyle execution.

## Key Finding: "Review-Only" is the top freestyle pattern

**Pattern**: `[REVIEW ONLY — no file edits expected. You are assessing worker output, not writing code.]`

- Appears in coach and tech-lead sessions (at least 3 of 30 recent sessions)
- Always freestyle — no workflow wraps it
- Consistent structure: receive worker output → assess quality → produce verdict
- Perfect candidate for a workflow because:
  1. Highly repetitive (runs every persistent-task iteration)
  2. Deterministic structure (read output → judge → verdict)
  3. Could enforce output format consistency

**Proposed workflow**: `review-output` or `assess-worker`
- Step 1: Load worker session output + success criteria
- Step 2: Agent produces structured assessment (pass/fail + reasoning)
- Step 3: Return verdict to persistent-task owner

## Other Freestyle Patterns

| Pattern | Frequency | Workflow Candidate? |
|---------|-----------|-------------------|
| Review-only assessment | 3+ sessions | ✅ Yes — top candidate |
| Heartbeat processing | 2+ sessions | ⚠️ Deferred (design doc says Phase 4+) |
| Investigation/archaeology | 2 sessions | Maybe — too varied |
| Coder fix sessions | 2+ sessions | Already covered by implement-and-verify |

## Recommendation
Create a `review-output` workflow to standardize the persistent-task review step. This would immediately increase workflow coverage since every persistent-task iteration includes a review.
