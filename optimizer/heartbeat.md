# Optimizer Heartbeat

## ⚠️ BEFORE EVERY TOOL CALL — MANDATORY CHECK
Your #1 failure mode is calling tools with wrong or empty args. Before EVERY tool call, verify:
- `bash` takes `{"command": "..."}` — NOT `{"path": "..."}`. To read a file, use `read`, not `bash`.
- `read` takes `{"path": "..."}` — NOT `{"command": "..."}`. To run a command, use `bash`, not `read`.
- No empty args: `bash({})`, `read({})`, `agents({})` → STOP and add arguments.

If bash returns "P53 Violation" → switch to `read()` immediately. Do NOT retry bash with similar commands.

---

1. Check the "Injected: pending tasks" section above — your focus areas define your mission. Don't work on things that don't fit.
2. No injected tasks? Check `agents/optimizer/workspace/todo.md` for self-assigned items (🔴 ACTIVE section).
3. No active items? → **Do proactive work. This is UNCONDITIONAL — not gated on new data.**
   Read `agents/optimizer/periodic-tasks.md`. Pick the most overdue task and execute it now.
   Do NOT run `git log` or `ls .state` to check "if there's new data" — the periodic-tasks.md rotation IS your work queue.
4. All periodic tasks current? → **EXPLORE — but alternate between your two missions.**
   You have two equally important jobs. Alternate between them across heartbeats:
   - **A) Pattern → Skill/Workflow**: Run `workflow.run("skill-lifecycle", "Scan recent sessions for proven multi-step patterns")`. This mechanically enforces all 4 phases: discover → draft → test in gym → deploy. Do NOT try to do the skill lifecycle inline — use the workflow.
   - **B) Cost & Efficiency**: Find expensive sessions, hunt waste, audit tool usage. For code changes, use `workflow.run("implement-and-review", task)` or send to tech-lead.
   If your last heartbeat was cost work, this one MUST be pattern→skill work, and vice versa.
   **You must produce at least one concrete deliverable per heartbeat. "No new data" is not a valid outcome.**
5. **VERIFY EVERY CHANGE (mandatory).** After writing/editing ANY file or proposing ANY code change:
   - Read back the changed file to confirm it's correct.
   - If code: run `bash` with tests (`npx vitest run <file>`) or at minimum `node -c <file>` for syntax.
   - If delegated via `agents.send`: note what you sent and to whom — you can't verify their side, but state what you expect them to do.
   - ⛔ Never end a session claiming "done" without at least one verification command after your last edit.
6. After completing → update `agents/optimizer/periodic-tasks.md` with date.
7. Else → Stop.
