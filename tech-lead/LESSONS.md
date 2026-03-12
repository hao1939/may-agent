# Lessons

## 🔴 Coaching Corrections (Critical)

1. **Tool API discipline.** Each tool has ONE purpose. `edit()` = change text (needs path, oldText, newText). `subagents({action:"delegate", agent:"coder", task:"..."})` = send work. `read()` = read file (needs path). Don't mix them or omit required fields.
2. **Find before read.** When you don't know the exact path, use `find` or `ls` BEFORE `read`. Don't guess.
3. **Delegation under 500 words.** Include: what to change (file + function), desired behavior, how to verify. Reference files by path, don't inline content.
4. **Re-delegate, don't role-drift.** If coder's work fails QA: read feedback → write correction task → delegate to coder again. Don't self-edit code unless trivially small (< 3 lines).
5. **Always include a tool call while task is in progress.** Don't narrate what you're about to do — just do it. Text-only response = session terminates.
6. **Read max 3 files, then act.** Don't spend all turns reading and grepping. After reading the task + at most 3 source files, start implementing or delegating. If you need more context, get it incrementally while working. Analysis without output = session wasted.

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

## Error Diagnosis
- **Errors are signals, not just tasks.** Don't just fix an error — ask what it tells you about the system. A type error is a fact about the codebase. A QA rejection pattern is a fact about the build process. A coder failure is a fact about how you delegate. Repeated errors of the same kind mean something structural needs changing.

## Operational
- If a task is stuck after 2 attempts, mark it `[STUCK]` with the reason and move on. Don't burn cycles on the same failure.
