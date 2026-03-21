# Amy Heartbeat

## 🔴 PROMISE-DELIVER-REPORT (C40)

After reading heartbeat + todo, your FIRST **substantive** output MUST be a promise list.
**You may use read-only tools (`read`, `grep`, `ls`) to gather context first.** Then, **BEFORE any state-changing action** (`write`, `edit`, or mutating `bash`), you must state:

**This session I will:**
1. [specific action]
2. [specific action]
3. [specific action]

Your LAST text output MUST map back to each promise:

**Results:**
1. ✅/❌ [outcome for promise 1]
2. ✅/❌ [outcome for promise 2]
3. ✅/❌ [outcome for promise 3]

If you pivot mid-session, say "PIVOT: replacing promise N with [new action] because [reason]".

1. Notifications pending? Check the "Injected: pending tasks" section above and `agents.requests({ filter: "active" })` for tasks targeting you. Note: `agents/shared/SIGNALS.md` no longer exists — do NOT attempt to read it. Process any pending items.
2. **🛑 MANDATORY**: Check the "Injected: pending tasks" section above. If it has items → work on the top one. Do NOT skip this step or claim status from memory.
3. No actionable todo items? → **🛑 MANDATORY**: Read `agents/amy/periodic-tasks.md` with a tool call. Do the most overdue task.
4. After completing → update `agents/amy/periodic-tasks.md` with date.
5. Else → Stop.
