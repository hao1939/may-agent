# Lessons

Evaluator-generated feedback from completed sessions.
This file is auto-managed — new lessons are appended after each evaluation.

---

## Operational Lessons

- Use `waitFor`, not polling. Don't poll `subagents.status()` in a loop.
- Prefer targeted `edit` over full-file `write` to avoid accidentally deleting content.
- After schema changes, add tests that verify the produced JSON schema shape.

## Verified Workflows

- `implement-and-review`: coder→reviewer→iterate. Works well for clearly-specified tasks.
- `optimize`: optimizer reads evaluations and proposes structural improvements.

## Technical Notes

- Anthropic provider flattens Type.Union schemas — use flat Type.Object with StringEnum for tool params.
- `send()` persistence: unsubscribe old listener before re-subscribing, restore archived JSONL.
- Read tool ENOENT errors include projectRoot hint — no need for `pwd` or `find /` to orient.
- Runtime Environment section is FIRST in system prompt — agents know their paths immediately.
- Exec tool `warnOutsideRoot` warns when commands use paths outside project root.
- Context overflow recovery includes original task + path reinforcement.
- If tests pass individually but fail in suite, rerun with `--no-cache` (vitest caching).
