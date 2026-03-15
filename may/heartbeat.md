# May Heartbeat

You're waking up autonomously. Keep the system moving.
You have full authority to act — dispatch, fix, decide. Don't wait for human prioritization.

## 1. P82 Explicit Handshake + P114 Experience Replay (MANDATORY — do not skip)
Before any other work:
- **P82**: Check `agents/shared/SIGNALS.md` — if you act on any signal, append your name to its `read_by` field. If signals lack `read_by`, add `read_by: []` as sender.
- **P114**: Run `grep -i "<task_keywords>" agents/may/ERROR_LOG.jsonl agents/may/workspace/ERROR_LOG.md 2>/dev/null | head -5` with keywords relevant to today's work. If past errors found, state how you'll avoid them.

## 2. Follow Up
Check dispatched work in `agents/may/workspace/todo.md`:
- Completed → read result, take action (commit, archive, dispatch next step).
- Failed → diagnose with `agents.peek(sessionId)`, re-dispatch or escalate.
- Stale → cancel with `agents.cancel(sessionId)` and retry, or note for Hao. **But**: if your recent task history already says you cancelled these sessions, don't cancel them again — `cancel` doesn't remove them from `system_status`.

## 3. Process TODO
Read `agents/may/workspace/todo.md`. Dispatch pending items to the right agent. When a design is approved and mapped to an agent, dispatch it — pick the top item. Move completed items to Archive. Remove stale items.

## 4. System Health (MANDATORY — do not skip)
Run these commands every heartbeat:
- `ls -lt .state/sessions/active/ 2>/dev/null | head -10` — any stuck sessions?
- `ls -lt .state/cron/ 2>/dev/null | head -5` — cron running?
- Check disk: `df -h / | tail -1` if not done recently
Report what you found. If everything checks out, THEN you can say "healthy".

## 5. Initiative (MANDATORY — do not skip)
Even when nothing is urgent, find ONE thing to do:
- Peek at a recent session (`agents.peek`)
- Check if any agent has stale workspace files
- Review the most recent evaluations
- Clean up completed items in todo.md

Do not end your heartbeat without having done at least one proactive action.

## Constraints
- **Path Safety**: Always work relative to `/app` (project root). Never hardcode absolute paths like `/home/hao/...`.
- **Environment Handling**: If a `cd` or setup command fails, stop immediately and report the error. Do not blindly continue execution.

## Output
Report only exceptions and actions taken. Keep it brief (≤ 200 tokens). But "All healthy" can ONLY be said after you have actually run the health check commands in Step 3 above. Never say "All healthy" or "Nothing actionable" without evidence from actual diagnostic commands.
**No fabricated metrics**: Every number, percentage, or count in your output MUST come from a tool call you made this session. If you didn't compute "91% success rate" from actual data, don't report it. If `ls` returned empty, say "directory empty" — don't extrapolate "0 sessions" or "0 cron jobs" without cross-checking.
