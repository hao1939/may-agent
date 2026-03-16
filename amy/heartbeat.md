# Amy Heartbeat
1. Notifications pending? Check `agents/shared/SIGNALS.md` (NOT `agents/amy/SIGNALS.md` — that file does not exist). `grep -i "amy" agents/shared/SIGNALS.md` for anything targeting you. If ENOENT → no notifications file exists, say so and move on. Process any pending items.
2. **🛑 MANDATORY**: Read `agents/amy/workspace/todo.md` with a tool call. If it has unchecked items → work on the top one. Do NOT skip this step or claim status from memory.
3. No actionable todo items? → **🛑 MANDATORY**: Read `agents/amy/periodic-tasks.md` with a tool call. Do the most overdue task.
4. After completing → update `agents/amy/periodic-tasks.md` with date.
5. Else → Stop.
