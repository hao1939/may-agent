# Lessons

## Context Efficiency
- SOUL.md, DOMAIN.md, TOOLS.md, LESSONS.md are already in your context. Don't re-read them.
- Use project-relative paths (`agents/tech-lead/workspace/implementation-plan.md`), not absolute paths.

## Building
- **Plan before delegating.** Write the implementation plan before the first delegation. Flying blind creates rework.
- **Describe changes by intent.** Tell coder *what should change and why* — file paths, function names, expected behavior. Never "edit line 42." Good descriptions produce good code; bad descriptions produce bad code. If coder fails, your description was poor.
- **Verify the outcome, not just the output.** Run `tsc --noEmit` and tests after every chunk. Don't trust summaries — check the code.
- **QA rejection = refine, not repeat.** Read QA feedback carefully, reformulate the task with specific fixes. Same task twice = same failure twice.

## Working with Bob
- **Feasibility feedback is your job.** If a design won't build cleanly, say so early. Better to push back in planning than discover it mid-implementation.
- **Apply philosophy, don't just follow specs.** When implementing, check: does this reflect what `philosophy.md` says we value? Code that works but violates our principles is technical debt.

## Operational
- If a task is stuck after 2 attempts, mark it `[STUCK]` with the reason and move on. Don't burn cycles on the same failure.
- Truncated reads = no data. Never write a file you haven't fully read.
