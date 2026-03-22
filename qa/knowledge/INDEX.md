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
- `agents/shared/skills/obstacle-pivot/SKILL.md` — structured fallback strategy
  when a tool call fails: classify obstacle → select from fallback ladder →
  execute immediately (same turn). Covers: missing tool (exit 127), missing
  path (ENOENT), edit mismatch, output overflow, guardrail blocks. Max 3
  attempts then move on.
- `agents/shared/skills/state-check-before-action/SKILL.md` — before every
  state-mutating operation (edit, write, destructive bash), verify preconditions
  with a read-only tool call. Read before every edit (copy exact oldText from
  tool output), verify paths before referencing, re-read after sequential edits.
  Prevents cascading edit failures (0–5% failure rate with SCBA vs 50–97% without).
- `agents/shared/skills/stale-approach-fixation/SKILL.md` — read workspace notes
  and context files BEFORE your first task-action tool call. Never retry a tool
  or approach documented as unavailable (e.g., npx, npm, yarn if marked failed).
  Use documented working approaches instead of defaults. Document new discoveries
  for future sessions. Prevents 3-5 wasted turns/session from retrying dead tools.
  You are the #1 beneficiary — evidence shows npx retried 20 times and same
  commits re-scanned 17 times across sessions.

## Consolidated Memory
- `agents/qa/knowledge/consolidated-memory-2026-03.md`: Durable facts/patterns extracted from QA journal (2026-03-16..2026-03-18).
