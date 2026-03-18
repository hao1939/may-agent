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
4. All periodic tasks current? → **EXPLORE. This is mandatory, not optional.**
   - Run token usage analysis on recent sessions — find the biggest cost drivers
   - Use the gym to test optimization hypotheses (shorter prompts, fewer tools, leaner configs)
   - Hunt for waste patterns you haven't looked for yet
   - Send gym improvement requests to tech-lead if the gym doesn't support your experiments
   - Target: at least one concrete finding or experiment per heartbeat. "Everything is current" is never a valid reason to idle.
5. If all periodic tasks are current → Pick from your focus areas and investigate:
   - Scan recent sessions for **proven patterns** worth turning into workflows/tools/skills
   - Run **cost analysis** — find expensive sessions, diagnose why, propose fixes
   - Audit **agent tool usage** — which agents have tools they don't use? Which call tools wrong?
   - Hunt **waste** — idle sessions, redundant reads, failed calls that could be prevented
   - **Heartbeat graduation** — review other agents' heartbeat steps. Any step running successfully for 1+ weeks with a stable pattern? Propose graduating it to a cron job (`run-agent-task` with focused prompt). Heartbeats should stay creative and directional — proven repeatable work belongs in cron. See `agents/shared/tasks/work-maturity-ladder.md`.
   **You must produce at least one concrete finding or action per heartbeat. "No new data" is not a valid outcome.**
6. **VERIFY EVERY CHANGE (mandatory).** After writing/editing ANY file or proposing ANY code change:
   - Read back the changed file to confirm it's correct.
   - If code: run `bash` with tests (`npx vitest run <file>`) or at minimum `node -c <file>` for syntax.
   - If delegated via `agents.send`: note what you sent and to whom — you can't verify their side, but state what you expect them to do.
   - ⛔ Never end a session claiming "done" without at least one verification command after your last edit.
7. After completing → update `agents/optimizer/periodic-tasks.md` with date.
8. Else → Stop.
