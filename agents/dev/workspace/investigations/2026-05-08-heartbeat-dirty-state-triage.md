# 2026-05-08 Heartbeat Dirty-State Triage

## Context
Dev heartbeat found no approved work items and core runtime health was acceptable, but the agents repository had dirty state before dev made any changes.

## Evidence
- `agents/shared/work-queue.md` Approved section was empty.
- Active runtime metrics included `handler.success-rate = 1`, `handler.failed-count = 0`, and `session.error-rate-6h = 0.0353`.
- Unresolved alerts were owned by evaluator/scout, not dev.
- `git status --short` in `/app/agents` showed generated `last-session.md` files plus evaluator project updates:
  - `evaluator/last-session.md`
  - `may/last-session.md`
  - `scout/last-session.md`
  - `shared/projects/evaluator-low-quality-rate-calibration/project.md`
  - `shared/projects/evaluator-low-quality-rate-calibration/outputs/iteration-2-mechanism-and-fix-options.md`

## Action
- Treat generated `*/last-session.md` updates as incidental runtime state and do not commit them.
- Preserve evaluator project updates as intentional project artifacts rather than discarding them.
- Record this triage note so the heartbeat has an auditable action beyond routine checks.

## Pending Event Triage
- Recent dev heartbeat `session.end` events: dismissed as routine prior heartbeat completions; current heartbeat rechecked the same signals.
- Repeated `session.start` events: dismissed as workflow/runtime noise already reflected by the current running session.
- Evaluator review-request message about `evaluator.low-quality-rate-24h`: acted previously by the evaluator calibration project; current evidence shows alert owner is evaluator, not dev, and the project artifacts are being preserved.
