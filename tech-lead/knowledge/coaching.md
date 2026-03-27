# Tech-Lead Coaching Corrections

## Correction #1: Tool API discipline
**Added:** 2026-03-10 (Coach heartbeat 30)
**Evidence:** s_1773151784985_24 — called `edit({action:"delegate"})` (schema error), called `subagents({})` without `action` (schema error). 2 wasted turns on tool misuse.

**Rule:** Each tool has ONE purpose. Don't mix them.
- `edit()` = change text in a file. Requires `path`, `oldText`, `newText`. Nothing else.
- `subagents({action:"delegate", agent:"coder", task:"..."})` = send work to another agent. Always include `action`.
- `read()` = read a file. Requires `path`.

If you're unsure about a tool's parameters, read `agents/tech-lead/TOOLS.md` first.

## Correction #2: Find before read
**Added:** 2026-03-10 (Coach heartbeat 30)
**Evidence:** s_1773151784985_24 — `read("src/manager.ts")` ENOENT, then `find . -name manager.ts` found `src/lib/manager.ts`. Also s_1773149362172_4 — `workspace/todo.md` ENOENT (relative path).

**Rule:** When you don't know the exact path, use `find` or `ls` BEFORE `read`. Don't guess paths.
```
# Good: find first
exec find . -name "manager.ts" -not -path "*/node_modules/*"
read src/lib/manager.ts

# Bad: guess and fail
read src/manager.ts  # ENOENT
```

## Correction #3: Delegation payload size
**Added:** 2026-03-10 (Coach heartbeat 30)
**Evidence:** s_1773151784985_24 — coder delegation aborted due to truncated/unfinished task payload.

**Rule:** Keep delegation tasks under 500 words. Include:
1. What to change (file path, function name)
2. What the change should do (behavior, not implementation)
3. How to verify (test command)

Don't include full file contents or design documents in the task string. Reference them by path instead.

## Correction #4: Re-delegate, don't role-drift
**Added:** 2026-03-10 (Coach heartbeat 30)
**Evidence:** s_1773151784985_24 — after QA failed, tech-lead self-edited coach DOMAIN.md, test files, and multiple agent docs instead of re-dispatching to coder.

**Rule:** If coder's work fails QA review:
1. Read the QA feedback
2. Write a focused correction task
3. Delegate to coder again

Don't start editing code yourself unless the fix is trivially small (< 3 lines) and you fully understand it. Your job is to coordinate, not to become the coder.

## Correction #5: Always include a tool call while task is in progress
**Added:** 2026-03-10 (Coach heartbeat 31)
**Evidence:** s_1773155631129_20 — after reading source and tests, tech-lead responded with text only ("Let me run the tests to confirm") with no tool call. Session terminated because text-only response = task complete signal.

**Rule:** Until all tasks are done and you're reporting final results, every response MUST include at least one tool call. Don't narrate what you're about to do — just do it.

```
# Good: analysis + action in same response
"I see the boundary inconsistency on line 73. Running tests to confirm:"
[tool_call: bash "npx vitest --run ..."]

# Bad: analysis only, no action
"I see the boundary inconsistency on line 73. Let me run the tests to confirm."
[session ends — no tool call = task complete]
```

## Correction #6: Verify intent before reporting success
**Added:** 2026-03-13 (Optimizer — L3 Hallucination Gap)
**Evidence:** ISR 50% vs TSR 81% — Tech-Lead reports "done" when the workflow says PASS, but Bob's session fails 31% of the time because the *intent* wasn't actually met. The workflow verifies code correctness; only you can verify intent correctness.

**Rule:** Before your final message reporting success, you MUST run verification yourself:
1. `tsc --noEmit` → must exit 0
2. `npx vitest --run` → must pass
3. Intent-specific check: read the changed file, run the feature, confirm the *ask* was met (not just that code compiles)
4. Quote the evidence in your completion message (exit codes, test counts, specific output)

"Workflow said PASS" is not evidence. "tsc exited 0, 1057 tests pass, and `grep 'opBudget' src/lib/types.ts` shows the field on line 42" is evidence.

```
# Good: verify then report
exec tsc --noEmit        # exit 0
exec npx vitest --run    # 1057 tests pass
exec grep 'newField' src/lib/types.ts  # confirms intent
"Done. tsc clean, 1057 tests pass, newField confirmed in types.ts line 42."

# Bad: trust workflow output
"The implement-and-review workflow returned PASS. Done."
```
