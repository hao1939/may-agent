# Lessons

_Staging area for behavioral fixes. Each entry should graduate into structure (heartbeat.md, DOMAIN.md, tool code) within 2 weeks, then be deleted._

## Active Band-Aids

- 🔴🔴 **Promise-Deliver-Report (C40, CS 1.2+1.3+1.4)**: Every heartbeat MUST follow this 3-step pattern:
  1. **PROMISE** — After reading heartbeat and todo, your NEXT text output MUST be a numbered deliverable list. Format exactly:
     ```
     **This heartbeat I will:**
     1. [specific action, e.g., "Dispatch item X to coder"]
     2. [specific action, e.g., "Check system health (tsc, vitest, git)"]
     3. [specific action, e.g., "Check active requests in request DB"]
     ```
     This must appear BEFORE any tool calls to execute work. It's your contract.
  2. **DELIVER** — Execute each promised item. If one becomes impossible (System Busy, blocked), say "PIVOT: item N blocked because [reason], replacing with [alternative]" — don't silently drop it.
  3. **REPORT** — Your final output MUST map back to each promise:
     ```
     **Results:**
     1. ✅ Dispatched item X to coder (agents.send at turn 4)
     2. ✅ System health: tsc clean, 1341 tests pass, git clean
     3. ❌ Request check: PIVOT — System Busy, dispatched remaining TODO instead
     ```
  - **MANDATORY**: Promise count must equal report count. Every promise appears in the report. Every report item traces to a promise or an explicit PIVOT.
  - **Anti-pattern**: ❌ Jumping into tool calls without stating deliverables first
  - **Anti-pattern**: ❌ Reporting things you didn't promise without saying PIVOT
  - **Anti-pattern**: ❌ Ending with "dispatched some items" without mapping to promises
  _(Added 2026-03-16. Combines common-sense items 1.2 (promise deliverable), 1.3 (deliver what promised), 1.4 (signal completion). Graduates when 5 consecutive heartbeats show explicit promise→deliver→report with matching counts.)_

- **Heartbeat is NOT auto-loaded**: You MUST `read()` heartbeat.md at the start of every heartbeat. _(Added 2026-03-14. Keep until infrastructure auto-loads heartbeat.)_

- 🔴🔴🔴 **DISPATCH BEFORE HEALTH CHECKS — Mandatory Order (C29, 3x NI)**: Your #1 failure mode is spending all tool calls on system investigation instead of dispatching tasks. The MANDATORY order is:
  1. Check the "Injected: pending tasks" section — these are auto-injected from the request DB
  2. `agents.send()` or `agents.call()` to dispatch pending items — do this IMMEDIATELY
  3. Only AFTER all items are dispatched/triaged → check system health and request DB (max 3 tool calls)
  - **Anti-pattern**: Batching system checks alongside task review in the same tool call group.
  - **Anti-pattern**: "Let me check system health" before dispatching. NO. Dispatch first.
  - **Self-check**: Before your session ends, count your `agents.send`/`agents.call` dispatches. If count = 0 and there were pending tasks, your heartbeat FAILED.
  _(Added 2026-03-15. Updated 2026-03-17: SIGNALS.md no longer exists, replaced with request DB. Graduates when 5 consecutive heartbeats dispatch ≥1 item before any health check.)_

- 🔴 **Claim-as-Record — Evidence for Every Assertion (C26, replaces No Fabricated Metrics)**: Every substantive claim in your output MUST cite the tool call or output that proves it. This applies to ALL claims, not just metrics:
  - **Status claims**: "No stuck sessions" → cite `ls .state/sessions/active/` output showing empty or specific entries
  - **Health claims**: "System healthy" → cite the specific health check commands you ran and their outputs  
  - **Count claims**: "3 pending items" → cite `grep -c` or `wc -l` output
  - **Comparison claims**: "Error count unchanged" → cite current count AND previous reference
  - **Negative claims**: "No tasks for me" → cite `agents.requests({ filter: "active" })` showing no tasks targeting me
  - **Anti-patterns**: ❌ "All agents running normally" (based on what?), ❌ "No new errors" (did you check?), ❌ "0 active sessions" from empty `ls` output (could be wrong path)
  - **Self-check before final output**: For every sentence in your summary, ask: "What tool output proves this?" If you can't point to one, either run the tool or remove the claim.
  _(Added 2026-03-15. Upgrades from "No Fabricated Metrics" to broader evidence discipline. Graduates when 5 consecutive heartbeats have zero ungrounded claims.)_

- 🔴 **~~Correct TODO Path~~** → **GRADUATED**: Pending tasks are now injected from the request DB. No todo.md file to read. _(Graduated 2026-03-17.)_

- ~~🔴 **Correct SIGNALS.md Path**~~ → **GRADUATED/OBSOLETE**: `agents/shared/SIGNALS.md` no longer exists. Task tracking is now via the request DB (`agents.requests()`). _(Graduated 2026-03-17. SIGNALS.md deleted.)_

- **No Re-Cancellation Waste (C20)**: `agents.cancel()` on idle sessions does NOT remove them from `system_status` active listings. If you cancelled sessions in a previous heartbeat and they still appear as "idle" in `system_status`, do NOT cancel them again. Only cancel sessions you haven't seen before. Check your recent task history summaries — if they mention "cancelled 14 stale sessions", those same sessions will still appear but are already handled. _(Added 2026-03-15. Saves ~14 wasted tool calls per heartbeat.)_

- ~~🔴 **Use handoff() for Cross-Agent Work (C24)**~~ → **GRADUATED/OBSOLETE**: The `handoff()` tool no longer exists. Use `agents.send()` for all cross-agent work (both task dispatch and artifact transfer). Include artifact paths in the task message. _(Graduated 2026-03-17. handoff() tool removed.)_

- 🔴 **System Busy = Pivot to Dispatch, Don't Loop (FM-1.3)**: When bash/system commands return "⏳ System Busy" or similar infrastructure blocks, do NOT retry the same command. You have a maximum of **1 retry** on any System Busy response. After that, pivot immediately to your PRIMARY job: dispatching pending tasks. System health checks are secondary to dispatch. If you can't check system health, skip it and process pending tasks instead. Never burn 3+ turns on commands that keep failing. _(Added 2026-03-15. s_72 q=0.25: 4 turns wasted on System Busy retries while pending tasks sat undispatched.)_

- 🔴 **C44: TOOL SCHEMA PRE-FLIGHT (7x FM-2.5)** — Before emitting ANY tool call: (1) Name the tool, (2) Confirm required field has a non-empty value, (3) Confirm you're using the right tool for the job. The three banned patterns are `bash({})`, `bash({command:""})`, and `read({command:...})`. These tend to occur at session boundaries and during rapid batching. SLOW DOWN before the last few calls of a session. _(Added 2026-03-17. Escalated from C39/SOUL.md FM-2.5 Guard. Replaces C39.)_

- 🔴 **Verify Tool Output Before Claiming Results (C36, 3x FM-3.1)**: When a bash command exits with nonzero code or produces empty/separator-only output, do NOT assert a conclusion from it. Specific rules:
  - **grep exit code 1** = "no matches found" — this is valid, but you MUST say "grep returned no matches (exit 1)" not just "0 results". Exit code 1 ≠ success.
  - **Empty output / just `---`** from `ls` or similar = could mean empty directory, wrong path, or command failure. State what the output actually was: "ls returned empty output, which could mean no files OR wrong path."
  - **Before claiming "No X"**: Verify the command ran correctly (exit 0) AND the output is interpretable. If unsure, run a second verification command.
  - **Anti-pattern**: ❌ `ls .state/sessions/active/` → `(no output)` → "No active sessions" (could be wrong directory)
  - **Anti-pattern**: ❌ `grep PENDING_ACK` on a deleted file → exit 1 → "0 PENDING_ACK signals" (exit 1 could mean file not found)
  - **Correct pattern**: ✅ "grep returned exit code 1 (no matches), confirming 0 PENDING_ACK entries" or ✅ "ls returned empty output; verified directory exists with `test -d`"
  _(Added 2026-03-16. 3 NI evals: s_1002 q=0.35, s_997 q=0.3, s_948 q=0.3 — all flagged FM-3.1 for ungrounded health assertions from ambiguous tool output. Graduates when 5 consecutive heartbeats have zero FM-3.1 flags for tool output misinterpretation.)_

- 🔴 **Dispatch or Archive Every Pending Task (3x recurrence)**: If there are ANY pending tasks in the injected section, you MUST take action on each before ending the heartbeat. For each pending task: (1) dispatch it to the correct agent via `agents.send()`, OR (2) mark it completed via `finish({ completed_items })` with a reason if done/obsolete, OR (3) explicitly state why it's blocked and on whom. Do NOT say "Dispatched: Nothing new" or "all items blocked" without having processed each pending item individually. Your heartbeat rule says: "A heartbeat where you dispatch zero work and have pending items is a FAILED heartbeat." **Self-check before final output**: count pending tasks — if count > 0 and you dispatched nothing, your heartbeat has FAILED. Go back and handle them. _(Added 2026-03-15. 3 evals flagged this: s_229 q=0.25, s_300 q=0.4, plus prior FM-2.2 entries. Graduates when 5 consecutive heartbeats have zero "dispatched nothing with pending items" violations.)_

- **Spawn Dispatch-Only Agents via agents.send/call (coach-reflect)**: When dispatching to Coder/Tech-Lead/QA/Optimizer, ALWAYS use `agents.call()` or `agents.send()`. Only agents with heartbeats (May, Coach, Bob, Scout) get pending tasks injected. For non-heartbeat agents, you MUST actively invoke them. _(Added 2026-03-16. Source: coach-reflect ts=1773571942192.)_

## Graduated ✅

- ~~P114 Experience Replay~~ → **GRADUATED to heartbeat.md step 1** (P114 MANDATORY gate). _(Graduated H534)_
- ~~P82 Read Receipts~~ → **GRADUATED to heartbeat.md step 1** (P82 MANDATORY gate). _(Graduated H534)_

## Graduated (remove after confirming structural fix works)

- ~~Shallow heartbeat (🔴🔴🔴)~~ → **GRADUATED to heartbeat.md** Steps 3-5 (mandatory health checks + initiative). Lesson measured as FAILED (5%→11% worse). Structure is the fix, not the lesson. _(Removed 2026-03-14)_
- ~~No Blind Writes~~ → **GRADUATED to agents/shared/LESSONS.md**. _(Removed 2026-03-14)_
- ~~Verify Paths~~ → **GRADUATED to agents/shared/LESSONS.md**. _(Removed 2026-03-14)_
- ~~Context Efficiency~~ → **GRADUATED to agents/shared/LESSONS.md**. _(Removed 2026-03-14)_
