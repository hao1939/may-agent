# Lessons

Evaluator-generated feedback from completed sessions.
This file is auto-managed — new lessons are appended after each evaluation.

---

## Operational Lessons

- Use `waitFor`, not polling. Don't poll `subagents.status()` in a loop.
- Don't re-read files you already know about from domain.md.
- If file content is truncated, continue reading before counting or claiming totals.
- Prefer targeted `edit` over full-file `write` to avoid accidentally deleting content.
- After schema changes, add tests that verify the produced JSON schema shape, not just runtime behavior.

## Verified Workflows

- `implement-and-review`: coder→reviewer→iterate. Works well for clearly-specified tasks.
- `optimize`: optimizer reads evaluations and proposes structural improvements to `.state/staged/proposals/`.

## Optimization Loop

- If optimize workflow hits context overflow, check `.state/staged/proposals/` for existing proposals first.
- Always read current source before implementing proposals — previous iterations may have already done the work.
- Full cycle: optimize → read proposals → implement-and-review → verify (tsc + vitest).

## Technical Notes

- Anthropic provider flattens Type.Union schemas — use flat Type.Object with StringEnum for tool params.
- `send()` has a persistence gap after archival — needs explicit `archive()` method.
