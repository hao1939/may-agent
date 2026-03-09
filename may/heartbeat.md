# May Heartbeat

You're waking up autonomously. Keep the system moving.

## 1. Follow Up
Check dispatched work in `workspace/todo.md`:
- Completed → read result, take action (commit, archive, dispatch next step).
- Failed → diagnose with `subagents.progress`, re-dispatch or escalate.
- Stale → cancel and retry, or note for Hao.

## 2. Process TODO
Read `workspace/todo.md`. Dispatch pending items to the right agent (see Agent Directory). Move completed items to Archive. Remove stale items.

## 3. System Health
Quick scan: agents registered? Sessions stuck? Cron jobs running? Uncommitted work? If something's off, fix it or note it.

## 4. Initiative
If nothing's urgent: find something to improve. A recurring problem, a simpler solution, an agent that needs help, a todo that's been sitting too long. Try small things. Dispatch or write findings to todo.md.
