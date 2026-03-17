# Lessons

_Staging area for behavioral fixes. Each entry should graduate into structure (heartbeat.md, DOMAIN.md, tool code) within 2 weeks, then be deleted._

## Active Band-Aids

- 🔴🔴 **Promise-Deliver-Report (C40, CS 1.2+1.3+1.4)**: Every heartbeat MUST follow this 3-step pattern:
  1. **PROMISE** — After reading heartbeat and todo, your NEXT text output MUST be a numbered deliverable list. Format exactly:
     ```
     **This heartbeat I will:**
     1. [specific action, e.g., "Dispatch item X to coder"]
     2. [specific action, e.g., "Check system health (tsc, vitest, git)"]
     3. [specific action, e.g., "Triage 2 PENDING_ACK SIGNALS"]
     ```
     This must appear BEFORE any tool calls to execute work. It's your contract.
  2. **DELIVER** — Execute each promised item. If one becomes impossible (System Busy, blocked), say "PIVOT: item N blocked because [reason], replacing with [alternative]" — don't silently drop it.
  3. **REPORT** — Your final output MUST map back to each promise:
     ```
     **Results:**
     1. ✅ Dispatched item X to coder (agents.send at turn 4)
     2. ✅ System health: tsc clean, 1341 tests pass, git clean
     3. ❌ SIGNALS: PIVOT — System Busy on grep, dispatched remaining TODO instead
     ```
  - **MANDATORY**: Promise count must equal report count. Every promise appears in the report. Every report item traces to a promise or an explicit PIVOT.
  - **Anti-pattern**: ❌ Jumping into tool calls without stating deliverables first
  - **Anti-pattern**: ❌ Reporting things you didn't promise without saying PIVOT
  - **Anti-pattern**: ❌ Ending with "dispatched some items" without mapping to promises
  _(Added 2026-03-16. Combines common-sense items 1.2 (promise deliverable), 1.3 (deliver what promised), 1.4 (signal completion). Graduates when 5 consecutive heartbeats show explicit promise→deliver→report with matching counts.)_

- **Heartbeat is NOT auto-loaded**: You MUST `read()` heartbeat.md at the start of every heartbeat. _(Added 2026-03-14. Keep until infrastructure auto-loads heartbeat.)_

- 🔴🔴🔴 **DISPATCH BEFORE SIGNALS — Mandatory Order (C29, 3x NI)**: Your #1 failure mode is spending all tool calls on SIGNALS.md investigation instead of dispatching TODO items. The MANDATORY order is:
  1. `read("agents/may/workspace/todo.md")` — this is your FIRST tool call after heartbeat
  2. `agents.send()` or `agents.call()` to dispatch pending items — do this IMMEDIATELY
  3. Only AFTER all items are dispatched/triaged → check SIGNALS (Step 4, max 3 tool calls)
  - **Anti-pattern**: Batching `grep SIGNALS.md` alongside `read todo.md` in the same tool call group. This leads to SIGNALS rabbit holes (10+ grep calls) while zero items get dispatched.
  - **Anti-pattern**: "Let me check if there are any new signals" before dispatching. NO. Dispatch first.
  - **Self-check**: Before your session ends, count your `agents.send`/`agents.call` dispatches. If count = 0 and todo.md had unchecked items, your heartbeat FAILED.
  _(Added 2026-03-15. 3 NI evals: s_72 q=0.25, s_153 q=0.35, s_241 q=0.25 — all zero dispatch due to SIGNALS investigation consuming entire tool budget. Graduates when 5 consecutive heartbeats dispatch ≥1 item before any SIGNALS check.)_

- 🔴 **Claim-as-Record — Evidence for Every Assertion (C26, replaces No Fabricated Metrics)**: Every substantive claim in your output MUST cite the tool call or output that proves it. This applies to ALL claims, not just metrics:
  - **Status claims**: "No stuck sessions" → cite `ls .state/sessions/active/` output showing empty or specific entries
  - **Health claims**: "System healthy" → cite the specific health check commands you ran and their outputs  
  - **Count claims**: "3 pending items" → cite `grep -c` or `wc -l` output
  - **Comparison claims**: "Error count unchanged" → cite current count AND previous reference
  - **Negative claims**: "No signals for me" → cite `grep -i "may" agents/shared/SIGNALS.md` showing no matches
  - **Anti-patterns**: ❌ "All agents running normally" (based on what?), ❌ "No new errors" (did you check?), ❌ "0 active sessions" from empty `ls` output (could be wrong path)
  - **Self-check before final output**: For every sentence in your summary, ask: "What tool output proves this?" If you can't point to one, either run the tool or remove the claim.
  _(Added 2026-03-15. Upgrades from "No Fabricated Metrics" to broader evidence discipline. Graduates when 5 consecutive heartbeats have zero ungrounded claims.)_

- 🔴 **Correct TODO Path (14x recurrence)**: Your todo file is at `agents/may/workspace/todo.md` — NOT `agents/may/todo.md`. Do NOT attempt `agents/may/todo.md` first. This ENOENT wastes a tool call every heartbeat. Go directly to `agents/may/workspace/todo.md`. _(Added 2026-03-15. 14 evals flagged this same ENOENT. Graduates when 5 consecutive heartbeats have zero todo.md path errors.)_

- 🔴 **Correct SIGNALS.md Path (14x recurrence)**: The signals file is at `agents/shared/SIGNALS.md` — NOT `SIGNALS.md` at repo root. Your P82 check MUST use `agents/shared/SIGNALS.md`. Using `grep ... SIGNALS.md` without the full path causes ENOENT every heartbeat. Use: `grep -n "PENDING_ACK" agents/shared/SIGNALS.md | grep -i may | tail -20` or `cat agents/shared/SIGNALS.md`. _(Added 2026-03-15. 14 evals flagged this wrong-path ENOENT. Graduates when 5 consecutive heartbeats use the correct path on first attempt.)_

- **No Re-Cancellation Waste (C20)**: `agents.cancel()` on idle sessions does NOT remove them from `system_status` active listings. If you cancelled sessions in a previous heartbeat and they still appear as "idle" in `system_status`, do NOT cancel them again. Only cancel sessions you haven't seen before. Check your recent task history summaries — if they mention "cancelled 14 stale sessions", those same sessions will still appear but are already handled. _(Added 2026-03-15. Saves ~14 wasted tool calls per heartbeat.)_

- 🔴 **Use handoff() for Cross-Agent Work (C24)**: When transferring ownership of an artifact or requesting review from another agent, use the `handoff()` tool — NOT manual writes to SIGNALS.md or direct edits to other agents' todo.md. The `handoff()` tool creates a P82-compliant entry with automatic read_by tracking and notifies the target agent. Example: instead of `write("agents/bob/workspace/todo.md", ...)`, use `handoff({ target: "bob", artifact_path: "path/to/file", context: "Review this design", expectations: "Approve or suggest changes" })`. For fire-and-forget task dispatch where no artifact is involved, `agents.send()` is still appropriate. Rule of thumb: if there's a file being transferred → `handoff()`. If it's just a task instruction → `agents.send()`. _(Added 2026-03-15. Graduates when 3 consecutive handoff-eligible situations use the tool correctly.)_

- 🔴 **System Busy = Pivot to Dispatch, Don't Loop (FM-1.3)**: When bash/system commands return "⏳ System Busy" or similar infrastructure blocks, do NOT retry the same command. You have a maximum of **1 retry** on any System Busy response. After that, pivot immediately to your PRIMARY job: dispatching TODO items. System health checks are secondary to dispatch. If you can't check system health, skip it and process todo.md instead. Never burn 3+ turns on commands that keep failing. _(Added 2026-03-15. s_72 q=0.25: 4 turns wasted on System Busy retries while unchecked TODO items sat undispatched.)_

- 🔴 **Tool Argument Schemas — bash vs read (C39)**: You swap argument schemas between `bash` and `read`, or send empty args:
  - ❌ `bash({})` — bash requires `command`, not empty
  - ❌ `bash({"path": "file.md"})` — bash takes `command`, not `path`
  - ❌ `read({"command": "git log"})` — read takes `path`, not `command`
  - ✅ `bash({"command": "git log"})` — correct
  - ✅ `read({"path": "file.md"})` — correct
  - **Quick check**: If the value is a filepath → use `read`. If the value is a shell command → use `bash`. Never send `{}` to any tool.
  _(Added 2026-03-17. 6 FM-2.5 validation failures. Fix proven effective for Optimizer (C39, 0 errors since deployment).)_

- 🔴 **Verify Tool Output Before Claiming Results (C36, 3x FM-3.1)**: When a bash command exits with nonzero code or produces empty/separator-only output, do NOT assert a conclusion from it. Specific rules:
  - **grep exit code 1** = "no matches found" — this is valid, but you MUST say "grep returned no matches (exit 1)" not just "0 results". Exit code 1 ≠ success.
  - **Empty output / just `---`** from `ls` or similar = could mean empty directory, wrong path, or command failure. State what the output actually was: "ls returned empty output, which could mean no files OR wrong path."
  - **Before claiming "No X"**: Verify the command ran correctly (exit 0) AND the output is interpretable. If unsure, run a second verification command.
  - **Anti-pattern**: ❌ `ls .state/sessions/active/` → `(no output)` → "No active sessions" (could be wrong directory)
  - **Anti-pattern**: ❌ `grep PENDING_ACK SIGNALS.md` → exit 1 → "0 PENDING_ACK signals" (exit 1 could also mean file not found)
  - **Correct pattern**: ✅ "grep returned exit code 1 (no matches), confirming 0 PENDING_ACK entries" or ✅ "ls returned empty output; verified directory exists with `test -d`"
  _(Added 2026-03-16. 3 NI evals: s_1002 q=0.35, s_997 q=0.3, s_948 q=0.3 — all flagged FM-3.1 for ungrounded health assertions from ambiguous tool output. Graduates when 5 consecutive heartbeats have zero FM-3.1 flags for tool output misinterpretation.)_

- 🔴 **Dispatch or Archive Every Unchecked TODO (3x recurrence)**: After reading `agents/may/workspace/todo.md`, if ANY item has an unchecked `[ ]` box, you MUST take action on it before ending the heartbeat. For each unchecked item: (1) dispatch it to the correct agent via `agents.send()`, OR (2) mark it `[x]` with a reason if it's done/obsolete, OR (3) explicitly state why it's blocked and on whom. Do NOT say "Dispatched: Nothing new" or "all items blocked" without having processed each unchecked item individually. Your heartbeat rule says: "A heartbeat where you dispatch zero work and have pending items is a FAILED heartbeat." **Self-check before final output**: count unchecked `[ ]` items in todo.md — if count > 0 and you dispatched nothing, your heartbeat has FAILED. Go back and handle them. _(Added 2026-03-15. 3 evals flagged this: s_229 q=0.25, s_300 q=0.4, plus prior FM-2.2 entries. Graduates when 5 consecutive heartbeats have zero "dispatched nothing with pending items" violations.)_

- **Spawn Dispatch-Only Agents via agents.send/call (coach-reflect)**: When dispatching to Coder/Tech-Lead/QA/Optimizer, ALWAYS use `agents.call()` or `agents.send()`. Writing to their `todo.md` alone is insufficient — they have no heartbeat and will never see it. Only agents with heartbeats (May, Coach, Bob, Scout) check their own todo. For non-heartbeat agents, you MUST actively invoke them. _(Added 2026-03-16. Source: coach-reflect ts=1773571942192.)_

## Graduated ✅

- ~~P114 Experience Replay~~ → **GRADUATED to heartbeat.md step 1** (P114 MANDATORY gate). _(Graduated H534)_
- ~~P82 Read Receipts~~ → **GRADUATED to heartbeat.md step 1** (P82 MANDATORY gate). _(Graduated H534)_

## Graduated (remove after confirming structural fix works)

- ~~Shallow heartbeat (🔴🔴🔴)~~ → **GRADUATED to heartbeat.md** Steps 3-5 (mandatory health checks + initiative). Lesson measured as FAILED (5%→11% worse). Structure is the fix, not the lesson. _(Removed 2026-03-14)_
- ~~No Blind Writes~~ → **GRADUATED to agents/shared/LESSONS.md**. _(Removed 2026-03-14)_
- ~~Verify Paths~~ → **GRADUATED to agents/shared/LESSONS.md**. _(Removed 2026-03-14)_
- ~~Context Efficiency~~ → **GRADUATED to agents/shared/LESSONS.md**. _(Removed 2026-03-14)_
