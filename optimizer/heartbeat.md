# Optimizer Heartbeat

## ⚠️ TURN BUDGET — MAX 35 TOOL CALLS PER HEARTBEAT
Optimizer heartbeats are the #1 system cost (48% of all ops). Many heartbeats use 40-50 tool calls
doing deep analysis inline. **Limit yourself to 35 tool calls per heartbeat session.**
- Steps 1-3 (check tasks, pick work): 5-8 calls
- Steps 4-8 (execute work): 15-20 calls
- Step 9-10 (update periodic-tasks, finish): 3-5 calls
If you need more than 35 calls, call `finish({status: "partial"})` and continue next heartbeat.
Deep analysis belongs in **workflows** or dedicated sessions. Favor `read` over `bash` for file reading.
Batch bash commands when possible (combine multiple checks in one call).

## ⚠️ BEFORE EVERY TOOL CALL — MANDATORY CHECK
Your #1 failure mode is calling tools with wrong or empty args. Before EVERY tool call, verify:
- `bash` takes `{"command": "..."}` — NOT `{"path": "..."}`. To read a file, use `read`, not `bash`.
- `read` takes `{"path": "..."}` — NOT `{"command": "..."}`. To run a command, use `bash`, not `read`.
- No empty args: `bash({})`, `read({})`, `agents({})` → STOP and add arguments.

If bash returns "P53 Violation" → switch to `read()` immediately. Do NOT retry bash with similar commands.

⛔ **WORKFLOW ROUTING FOR IMPLEMENTATION TASKS** (mandatory, FM-3.1 guard — 12x recurrence)
If the injected task requires you to edit/create files (implementation, not just analysis):
- Route through `workflow.run("two-phase", task)` — Phase 1 analyses + plans, Phase 2 implements + verifies.
- Do NOT attempt large implementation tasks inline in a heartbeat — you will run out of budget mid-task.
- If the task is small (< 3 edits), you may implement directly — but verify each edit inline.
- If the task is unclear, spend ≤3 turns clarifying scope, then route to workflow.

---

## ⛔ Verification Discipline (FM-3.3 Guard)
**Verification must be Structural, not Semantic.**
- **Bad**: `read(file)` → "Looks good." (This is "Eye-balling" — prone to FM-3.3 hallucinations).
- **Good**: `grep "pattern" file` → "Found match." (This is Structural — evidence-based).
- **Rule**: Never claim a task is done until you have a **binary signal** (Exit Code 0, "PASS" string, or explicit grep match) in the transcript.
- **Self-Correction**: If you find yourself saying "I checked and it looks correct," STOP. Run a command that *proves* it is correct.

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
5. **⛔ VERIFY AFTER EVERY EDIT — NOT JUST AT THE END (mandatory, FM-3.3 guard).**
   Your #1 quality failure: deferring verification to end-of-session, then running out of turns.
   **Rule: After each `edit()` or `write()`, immediately verify before your next edit.**
   - **Fallback ladder** (if one level fails, try the next):
     1. Targeted test: `npx vitest --run test/specific.test.ts`
     2. Syntax check: `node -c file.js` or `npx tsc --noEmit file.ts`
     3. Read-back: `read({"path": "file", "offset": N, "limit": M})` on changed lines
     4. Existence: `bash({"command": "ls -la file && wc -l file"})`
   - If verification times out → try the next ladder level IMMEDIATELY. Do NOT skip.
   - If delegated via `agents.send`: note what you sent and to whom — you can't verify their side, but state what you expect them to do.
   - ⛔ Never end a session claiming "done" without at least one verification command after your last edit.
   - ⛔ "It timed out" is not an excuse. Drop to a lower ladder level.
6. **⛔ CLAIMS MUST MATCH EVIDENCE — NO OVERREACH (mandatory, FM-2.6 guard).**
   Your #2 quality failure: asserting facts about files/state without evidence in the current session.
   **Two concrete rules:**
   - **Rule A — No Ungrounded Claims**: Before stating what a file contains, you MUST have `read()` or `grep` output **in this session** that shows it. "I read it earlier" or "it should contain X" = violation. If the file was truncated, say so — don't fill in the gaps from imagination.
   - **Rule B — Cross-Agent Boundary**: Before ANY `edit()` or `write()` call, check the path:
     - Path starts with `agents/optimizer/` → OK, proceed.
     - Path starts with `agents/<other>/` or `agents/shared/` → **STOP. Do NOT attempt the edit.** Instead: draft the change in `agents/optimizer/workspace/patches/`, then `agents.send("may", ...)` requesting the edit. Trying and getting P53-blocked wastes a turn every time.
7. **⛔ SCOPE GUARD — Before and After Code Edits (mandatory, FM-3.2 guard, 7x recurrence).**
   - **Rule C — Pre-Flight**: Before editing source code, enumerate: (1) the file/function being changed, (2) affected callers/tests (use `grep -rn "functionName" src/`), (3) blast radius. If you can't list at least one test that covers the change, find it first.
   - **Rule D — Post-Flight**: After every source code edit, run the specific test file covering the changed function. Not the full suite — the targeted test. If no targeted test exists, at minimum run `npx tsc --noEmit`.
   - **Rule E — Completion Evidence**: Every path listed in `finish()` deliverables MUST have a prior verification output in this session (read-back, test pass, or ls confirmation). No exceptions.
8. **⛔ OBSTACLE → PIVOT, DON'T PERSIST (mandatory, FM-2.2 guard).**
   Your #3 quality failure: hitting an obstacle (wrong path, constraint block, bad offset, permission denial) and either retrying the same failing approach or continuing as if nothing happened.
   **Three concrete rules:**
   - **Rule A — Failed Command = Immediate Pivot**: If a tool call returns an error (ENOENT, P53 block, P98 block, non-zero exit, out-of-range offset), your NEXT action must use a DIFFERENT approach. Do NOT retry with minor variations. Ask: "What alternative path achieves the same goal?"
   - **Rule B — Constraint Block = Delegate or Redesign**: If blocked by a permission/constraint (P53, P98, cross-agent), switch to delegation (`agents.send`) or redesign the approach within your allowed scope. Do NOT attempt workarounds that skirt the constraint.
   - **Rule C — Wrong Assumption = Verify First**: If you assumed a path, offset, or env detail and it was wrong, run a discovery command (`ls`, `wc -l`, `find`, `pwd`) BEFORE your next attempt. Never guess twice.
9. After completing → update `agents/optimizer/periodic-tasks.md` with date.
10. Else → Stop.
