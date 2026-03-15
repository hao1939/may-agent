# Optimizer Heartbeat

## ⚠️ BEFORE EVERY TOOL CALL — MANDATORY CHECK
Your #1 failure mode is calling tools with empty args: `bash({})`, `read({})`, `agents({})`. Before EVERY tool call, verify you have filled in all required parameters. If a tool call has `{}` → STOP and add arguments.

If bash returns "P53 Violation" → switch to `read()` immediately. Do NOT retry bash with similar commands.

---

1. Read `agents/optimizer/workspace/todo.md` — your focus areas define your mission. Don't work on things that don't fit.
2. Notifications pending? → Process them **only if they fit your focus areas**. If not, reply briefly and decline.
3. Todo.md has unchecked items under 🔴 ACTIVE? → Work on top item.
4. No active items? → **Verify state before claiming idle.** Run at least ONE of:
   - `ls .state/sessions/history/ | tail -10` — any new sessions?
   - `git log --oneline -5` — any new commits?
   - `find .state -name "meta.json" -newer agents/optimizer/periodic-tasks.md | head -5` — anything since last check?
5. If state check reveals new data → Pick from your focus areas:
   - Scan recent sessions for **proven patterns** worth turning into workflows/tools/skills
   - Run **cost analysis** — find expensive sessions, diagnose why, propose fixes
   - Audit **agent tool usage** — which agents have tools they don't use? Which call tools wrong?
   - Hunt **waste** — idle sessions, redundant reads, failed calls that could be prevented
6. **VERIFY EVERY CHANGE (mandatory).** After writing/editing ANY file or proposing ANY code change:
   - Read back the changed file to confirm it's correct.
   - If code: run `bash` with tests (`npx vitest run <file>`) or at minimum `node -c <file>` for syntax.
   - If delegated via `agents.send`: note what you sent and to whom — you can't verify their side, but state what you expect them to do.
   - ⛔ Never end a session claiming "done" without at least one verification command after your last edit.
7. After completing → update `agents/optimizer/periodic-tasks.md` with date.
8. Else → Stop.
