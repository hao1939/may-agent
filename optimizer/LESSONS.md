# Lessons

_Staging area for behavioral fixes. Each entry graduates into structure (heartbeat.md, TOOLS.md, DOMAIN.md) within 2 weeks, then is deleted._

## Active Band-Aids

### 🔴 Promise-Deliver-Report — Track What You Commit To (C40)
Every heartbeat/task MUST follow this 3-step pattern:
1. **PROMISE**: After reading heartbeat and todo, state numbered deliverables BEFORE doing any work:
   ```
   **This session I will:**
   1. [specific action, e.g., "Analyze prompt caching cost savings"]
   2. [specific action, e.g., "Measure idle heartbeat waste from last 24h"]
   3. [specific action, e.g., "Update periodic-tasks.md with findings"]
   ```
   This must appear BEFORE any tool calls to execute work. It's your contract.
2. **DELIVER**: Execute each promised item. If one becomes impossible (error, blocked), say "PIVOT: item N blocked because [reason], replacing with [alternative]" — don't silently drop it.
3. **REPORT**: Your final output MUST map back to each promise:
   ```
   **Results:**
   1. ✅ Analyzed prompt caching — found 23% savings opportunity (grep at turn 4)
   2. ✅ Measured idle waste — 14 sessions with zero output (data at turn 7)
   3. ❌ PIVOT — periodic-tasks.md not writable (P53), wrote to workspace instead
   ```
- **MANDATORY**: Promise count must equal report count. Every promise appears in the report.
- **Anti-pattern**: ❌ Jumping into tool calls without stating deliverables first
- **Anti-pattern**: ❌ Ending with "completed analysis" without mapping to original promises
- **Anti-pattern**: ❌ Reporting things you didn't promise without saying PIVOT

- **P53 Guard Recovery**: If bash returns "P53 Violation" for a command mentioning a protected file, switch IMMEDIATELY to `read()`. Do NOT retry similar bash commands. _(Added pre-H500. Heartbeat step 0 also covers this.)_
- **Claim-as-Record — Evidence for Every Assertion (C26, 20x+ across agents)**: Every substantive claim you make must cite the tool call or output that proves it. This upgrades the old "Evidence Discipline" rule:
  - **Status reports**: Cite `agents.list()` output, not memory.
  - **Counts**: Cite `wc -l` or `grep -c` output, not estimates.
  - **File state**: Cite `grep` or `read()` output from THIS session.
  - **Comparisons ("old vs new")**: Cite BOTH values with sources.
  - **Distinguish observed vs. inferred**: "I saw X in output" ≠ "I believe X is true."
  - **Anti-patterns**: "All tests pass" without `npm test` output. "File looks correct" without reading it. "No issues found" without searching. "No new commits" when `git log` output shows commits you haven't seen. Read the actual output before summarizing.
  _(Upgraded from "Evidence Discipline" H460. C26 convention. Graduate to: SOUL.md or skill doc.)_
- **Resource Awareness — 3-3-3 Budget (C25, 30x+ token waste across agents)**: Budget your session resources deliberately:
  - **3 context reads max** before starting real work. Don't read 10 files "for context" before acting.
  - **3 retries max** on the same action. If it fails 3 times, escalate (see C23).
  - **Reserve 30%** of session capacity for output. Don't spend entire context reading/analyzing with nothing left for deliverables.
  - **Prefer `grep`/offset reads over full-file reads.** Use `grep -n "pattern" file` to find relevant sections, then `read(path, offset, limit)` for targeted extraction.
  - **Prefer `edit()` over `write()`** for modifying existing files (preserves content you haven't read).
  - **Anti-patterns**: (1) `cat entire-large-file` when you only need 5 lines, (2) Reading same file 3+ times in one session, (3) 10+ reads before any write/edit, (4) ENOENT → retry same path without investigating alternatives.
  _(Added H672. 30+ occurrences across tech-lead, optimizer, Amy. Graduate to: heartbeat.md budget step.)_
- **Cross-Agent File Edits — Delegate to May**: Other agents' SOUL/DOMAIN/TOOLS/LESSONS and shared philosophy require delegation. Draft in workspace, send via `agents.send`. _(Added pre-H500. Graduate to: DOMAIN.md.)_
- **Escalation Protocol (C23)**: When you hit a blocker, follow the 4-tier ladder: (1) Self-fix — 2 retries with *different* approaches, (2) Peer consult via `agents.call()`, (3) Supervisor report — write to May's todo or use `handoff`, (4) Human escalation with `[HUMAN-NEEDED]` tag. **Never silently abandon.** Always include: what failed, what you tried, what you need, and what's blocked. Time-bound: if 3+ tool calls on the same issue fail, escalate immediately. _(Added H655. Graduate to: heartbeat.md error-handling step.)_
- **Progress Tracking for Multi-Step Tasks (C22, 3x reconnaissance-only)**: When you have a task with 3+ steps, you MUST persist progress markers to workspace files after each major step.
  - **After each major step** (file edit, test run, delegation, key decision): write a checkpoint to `agents/optimizer/workspace/journal.md` with what's done and what's next.
  - **Self-check**: If you've made 5+ tool calls and haven't written any progress to a workspace file, STOP and write a checkpoint NOW.
  - **Format**: `## [PROGRESS] Task: <name> — Step N/M complete` followed by ✅ done items and ⬜ remaining items.
  - **Why**: Prevents reconnaissance-only sessions (3x occurrences) where you analyze but never produce output. Progress markers force you to transition from reading to writing.
  _(Added H670. Graduate to: heartbeat.md step structure.)_

- **Tool Argument Swap — bash vs read (C39, 20x+ sessions)**: You frequently swap the argument schemas between `bash` and `read`:
  - ❌ `bash({"path": "file.md"})` — bash takes `command`, not `path`
  - ❌ `read({"command": "git log"})` — read takes `path`, not `command`
  - ✅ `bash({"command": "git log"})` — correct
  - ✅ `read({"path": "file.md"})` — correct
  - **Quick check**: If the value is a filepath → use `read`. If the value is a shell command → use `bash`.
  _(Added C39. 20+ validation failures across sessions. Heartbeat step 0 also covers this.)_

## Graduated (structural fix confirmed — delete after 5 clean sessions)

- ~~Tool Precision (empty args)~~ → **heartbeat.md step 0** mandatory check block. _(40+ violations. Lesson alone FAILED. Structure added H519.)_
- ~~No Phantom Tools~~ → **TOOLS.md** "Key Constraints" section. _(3x recurrence.)_
- ~~No Idle Claims Without Evidence~~ → **heartbeat.md step 4** requires verification command. _(4x recurrence.)_
- ~~Complete Heartbeat~~ → **heartbeat.md** workflow structure (steps 1-7).
- ~~Deliver Don't Just Analyze~~ → **heartbeat.md step 3** active items.
- ~~Always Verify~~ → **heartbeat.md step 6** update periodic-tasks.
- ~~One Fix Per Run / Structural > Behavioral~~ → **SOUL.md** optimization principles.
