# Implement → Review → Commit

## Context
The standard path for any code change. This is the most-used pattern in the system
and is **mandatory** — no code change should bypass QA review.

## Agents Involved
- **May** — dispatches workflow, commits after approval
- **Tech-Lead** — decomposes task, drives Coder + QA
- **Coder** — implements the change
- **QA** — reviews the change independently

## Steps
1. **May dispatches** via `workflow.run("implement-and-review", task)` or
   `agents.call("tech-lead", task)` depending on complexity.
2. **Tech-Lead** breaks the task into implementation steps and delegates to Coder.
3. **Coder implements** — writes code, runs `tsc`, runs tests.
4. **QA reviews** — checks correctness, style, edge cases. Returns PASS or FAIL.
5. **On FAIL**: Tech-Lead routes QA feedback back to Coder for fixes. Loop up to
   2 times. If still failing after 3 attempts, escalate to May.
6. **On PASS**: May commits with `exec("git add <specific-files> && git commit -m 'type: description'")`

## Key Lessons
- **Never `git add -A`** — always specify files explicitly.
- **QA is advisory** — May can override a FAIL for trivial nitpicks, but be sure.
- **Context is everything** — Tech-Lead and Coder start with zero context. Pass
  all relevant file paths, constraints, and the "why" in the task description.
- **One logical change per workflow** — don't bundle unrelated changes.
- For `agents/` repo changes: `cd agents/ && git add <files> && git commit -m "msg"`.

## Variations
- **Simple changes** (config edits, docs): May can dispatch directly to `tech-lead`
  with `agents.call` instead of using the full workflow.
