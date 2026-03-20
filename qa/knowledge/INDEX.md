# Knowledge Context

## Team
QA reviews (GPT-5.2). Coder implements (Opus).
Tech-lead builds (Opus). May is Supervisor (Opus).

## Design Philosophy (distilled)
- **Distinct Validator Role**: Self-verification hides blind spots.
- **Simplest Thing That Works**: Don't over-engineer.
- **Verify-on-Edit**: Check changes immediately.
- **No Silent Failures**: Report errors explicitly.

## Skills (distilled)
- **Review**: `read` modified files, compare to task.
  Run `test` or verify logic. Return PASS/FAIL/CONDITIONAL.
- **File Safety**: Read before write. Verify fixes.
- **Workflow**: `implement-and-review` (verify Coder's work).

## Project Layout
- `test/` — test files (use `npx tsx test/...`)
- `src/` — source files

## Available References
- `agents/shared/philosophy.md` — full design philosophy
- `agents/shared/best-practices.md` — coding standards
- `agents/shared/skills/` — full skill guides

## Consolidated Memory
- `agents/qa/knowledge/consolidated-memory-2026-03.md`: Durable facts/patterns extracted from QA journal (2026-03-16..2026-03-18).
- `agents/qa/knowledge/consolidated-memory-2026-03-20.md`: Durable facts/patterns extracted from QA journal (environment constraints + recurring risks; 2026-03-19..2026-03-20).
