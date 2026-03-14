# Lessons

## 🔴🔴🔴 STOP — READ THIS FIRST (3x failure, mandatory compliance)

**YOU HAVE FAILED YOUR HEARTBEAT 3 TIMES (s_331, s_446, s_602) BY DOING THIS:**
1. Read heartbeat.md ✓
2. Read todo.md ✓
3. See items are blocked on Hao
4. Say "All healthy. Nothing actionable." ← **THIS IS THE BUG**
5. STOP without running Steps 3 or 4 ← **THIS IS WRONG**

**"Blocked on Hao" does NOT mean "nothing to do."**

**After reading todo.md, you MUST CONTINUE to Steps 3 and 4. Here is exactly what to do:**

**Step 3 — Run these commands (copy-paste them):**
```
ls -lt .state/sessions/active/ 2>/dev/null | head -10
ls -lt .state/cron/ 2>/dev/null | head -5
df -h / | tail -1
```

**Step 4 — Do at least ONE of these:**
- `ls -lt .state/sessions/history/ | head -5` and peek at a recent session
- Check agents/.lab/ for stale experiments
- Archive completed todo items

**NEVER output "All healthy" unless you ran the Step 3 commands above.**
**NEVER end your heartbeat after only 2-3 tool calls. Minimum is 5.**

## 🔴 Critical Safety
- **No Blind Writes**: Never write to a file if your `read()` was truncated.
- **⚠️ PATHS: You run inside `/app`.** Use relative paths (e.g., `agents/may/workspace/todo.md`) or `/app/...`. **NEVER** use `/Users/hao/...`, `/home/hao/...`, or any other non-`/app` absolute path — those don't exist here and will fail. Don't `cd` to non-existent directories.
- **Identity**: Files at `agents/may/`.

## Operational Discipline
- **Action Over Reporting**: Dispatch approved todos immediately. Don't list backlog.
- **Brevity in output**: Heartbeat REPORTS should be ≤ 200 tokens. But you MUST still do the work — read heartbeat.md, follow each step, run actual checks. Brevity applies to your final summary, not to skipping steps.
- **Proactive Reporting**: Report results to Hao immediately upon task completion.

## Cooperation
- **Call vs Send**: Use `agents.call` for blocking work (results needed now). Use `agents.send` for background work.
- **Fallback**: If coder callDeny, use `workflow.run("implement-and-review", task)`.

## Operational
- **Context Efficiency**: SOUL/DOMAIN/TOOLS/LESSONS are auto-loaded. Don't re-read them. But `heartbeat.md` is NOT auto-loaded — you MUST `read()` it at the start of every heartbeat and follow its steps in order.
