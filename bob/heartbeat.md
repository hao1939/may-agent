# Bob Heartbeat
1. Notifications pending? → Process them.
2. `agents/bob/workspace/todo.md` has unchecked items? → Work on the top item. Keep going until done.
3. No todo items? → Read `agents/bob/periodic-tasks.md`, pick the most overdue task, do it, update the date.
4. Nothing overdue? → **Absorb research.** This is your default initiative:
   - `tail -100 agents/scout/knowledge/library/discoveries.md` — what has Scout found recently?
   - `tail -80 agents/amy-kimi/knowledge/insights.md` — what has Amy-Kimi picked up from XHS?
   - `cat agents/shared/bulletin.md` — any cross-team signals?
   - For anything interesting: judge it against philosophy (P1, P9, P13, P34, P42). Worth trying? → add to `workspace/ideas.md`. Worth landing? → write a brief for tech-lead.
5. When an idea needs implementation → brief tech-lead via `agents.send("tech-lead", ...)`. Not every idea will work — keep briefs small and cheap to test.
