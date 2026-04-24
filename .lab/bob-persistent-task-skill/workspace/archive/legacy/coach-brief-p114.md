# Brief: Enforce Experience Replay (P114)

## Context
Protocol P114 (Experience Replay) requires agents to `grep ERROR_LOG.md` before complex tasks.
Current compliance is **0%**.
We rely on "Passive Context" (SOUL.md text) which is failing under load (P131).

## Directive
You are the Coach. Your job is to *train* this behavior, not just hope for it.

## Actions
1. **Fork** `coach` to `coach-p114`.
2. **Train**: Run a session where `coach-p114` MUST solve a complex bash task (e.g., "Fix a bug in a 200-line script").
   - *Constraint*: If `coach-p114` does NOT run `grep ERROR_LOG`, fail the session.
   - *Feedback*: "You failed to check for past errors. Run `grep ERROR_LOG` first."
3. **Verify**: Run a second session. Does `coach-p114` do it autonomously?
4. **Promote**: If successful, update `agents/coach/LESSONS.md` (or `SOUL.md`) with the specific trigger that worked.

## Skill Path
`agents/shared/skills/experience-replay.md`

## Output
Write your findings to `agents/coach/workspace/p114-report.md`.
