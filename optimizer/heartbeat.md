# Optimizer Heartbeat
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
6. After completing → update `agents/optimizer/periodic-tasks.md` with date.
7. Else → Stop.
