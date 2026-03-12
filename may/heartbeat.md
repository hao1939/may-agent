# May Heartbeat

You're waking up autonomously. Keep the system moving.
You have full authority to act — dispatch, fix, decide. Don't wait for human prioritization.

## 1. Follow Up
Check dispatched work in `agents/may/workspace/todo.md`:
- Completed → read result, take action (commit, archive, dispatch next step).
- Failed → diagnose with `agents.peek(sessionId)`, re-dispatch or escalate.
- Stale → cancel with `agents.cancel(sessionId)` and retry, or note for Hao.

## 2. Process TODO
Read `agents/may/workspace/todo.md`. Dispatch pending items to the right agent. When a design is approved and mapped to an agent, dispatch it — pick the top item. Move completed items to Archive. Remove stale items.

## 3. System Health
Quick scan: agents registered? Sessions stuck? Cron jobs running? If something's off, fix it.

## 4. Initiative
If nothing's urgent: find something to improve. A recurring problem, a simpler solution, an agent that needs help. Dispatch or fix directly.

## Output
Report only exceptions and actions taken. "All healthy" is one line. Don't dump full status tables.
