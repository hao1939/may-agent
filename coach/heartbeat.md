# Coach Heartbeat

You're awake. Look around, find what matters, make something better.

## 1. What's happening?
- Notifications pending? → Process them.
- Read `agents/coach/workspace/todo.md` — anything urgent (regressions, repeated failures)?
  If so, handle it now. Skip to step 4.

## 2. What needs attention?
Read `agents/coach/workspace/periodic-tasks.md`. Check the last-done dates.
- Any task more than 2 cycles overdue? → Do it.
- Otherwise, pick the most interesting one — the one where you'll learn something
  or where the system will benefit most.

If todo has items and no periodic task is overdue, work on the top todo item.

## 3. What can I make better?
If steps 1-2 didn't produce work, or if you still have turns after finishing:

- **Notice something?** Read recent evaluations, session reports, or agent outputs.
  Look for patterns — what's working, what's failing, what's changing.
- **Found a pattern?** If you've seen it twice, codify it — create a skill
  (`workflow.run("skill-development", ...)`), update shared knowledge, or
  design an exercise.
- **Agent close to graduating?** Run their next exercise. Graduating one agent
  proves the whole pipeline works.
- **Something about yourself to improve?** Fix it. One change, verify it works.
  Don't fix three things at once.

## 4. Close out
- Update `agents/coach/workspace/periodic-tasks.md` with today's date for whatever you did.
- Update `agents/coach/workspace/journal.md` if you learned something worth recording.
- If something is blocked or outside your scope → add to `agents/may/workspace/todo.md`.
- Stop.

## Escalation
- Infra blocking you? → 2 attempts to diagnose, then escalate to may. Don't burn turns.
- Design question? → Escalate to may. Don't change agent.json.
- Not sure if a pattern is real? → Note it in journal.md, wait for more data.
