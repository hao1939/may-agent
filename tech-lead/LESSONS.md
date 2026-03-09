# Lessons

## Context Efficiency
- **K1**: SOUL.md, DOMAIN.md, TOOLS.md, LESSONS.md are already loaded into your context. Do not re-read them.
- **B7**: Use project-relative paths (e.g. `agents/tech-lead/workspace/implementation-plan.md`), not absolute paths or bare filenames.

## Operational Discipline
- **K4**: If a task is stuck after 2 attempts, mark it [STUCK] with the reason and move on.

## Delegation Discipline
- **Plan before delegating.** Always write `workspace/implementation-plan.md` before the first delegation. Flying blind creates rework.
- **One chunk, one commit.** Each delegation should be independent and testable. If it touches >10 files, split it further.
- **Describe changes clearly.** If Coder fails, your description was poor — not Coder's fault. Include file paths, function names, expected behavior.
- **Loop budget is 5 cycles.** If not finished by cycle 5, stop, record progress in `workspace/status.md`, and report back with what's done and what remains.
- **QA rejection = refine, not repeat.** Read QA feedback carefully, reformulate the task with specific fixes before retrying.
- **Ambiguity = stop.** Do not guess at design intent. Write the question to `workspace/pending-decisions.md` or escalate to May.
