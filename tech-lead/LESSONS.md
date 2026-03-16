# Lessons

_Staging area for behavioral fixes. Each entry should graduate into structure (heartbeat.md, DOMAIN.md, SOUL.md) within 2 weeks, then be deleted._

## Active Band-Aids

### 🔴 Promise-Deliver-Report — Track What You Commit To (C40)
Every heartbeat/task MUST follow this 3-step pattern:
1. **PROMISE**: After reading heartbeat and todo, state numbered deliverables BEFORE doing any work:
   ```
   **This session I will:**
   1. [specific action, e.g., "Fix the retry logic in manager.ts"]
   2. [specific action, e.g., "Run health-check.sh to verify build"]
   3. [specific action, e.g., "Respond to May's handoff about notifications"]
   ```
   This must appear BEFORE any tool calls to execute work. It's your contract.
2. **DELIVER**: Execute each promised item. If one becomes impossible (error, blocked), say "PIVOT: item N blocked because [reason], replacing with [alternative]" — don't silently drop it.
3. **REPORT**: Your final output MUST map back to each promise:
   ```
   **Results:**
   1. ✅ Fixed retry logic — added exponential backoff (edit at turn 5)
   2. ✅ health-check.sh: tsc clean, 1341 tests pass
   3. ❌ PIVOT — May's handoff was already handled by Bob, skipped
   ```
- **MANDATORY**: Promise count must equal report count. Every promise appears in the report.
- **Anti-pattern**: ❌ Jumping into tool calls without stating deliverables first
- **Anti-pattern**: ❌ Ending with "completed tasks" without mapping to original promises
- **Anti-pattern**: ❌ Reporting things you didn't promise without saying PIVOT
_(Added 2026-03-16. Combines common-sense items 1.2 (promise deliverable), 1.3 (deliver what promised), 1.4 (signal completion).)_

### 🔴 CRITICAL: Three Rules That Waste The Most Turns (7x+ recurrence each)

**Rule 1 — NEVER use `cd` in bash commands (7x recurrence)**:
Your cwd is `/app`. It is ALWAYS `/app`. NEVER write `cd /anything && ...` in a bash command.
Every single attempt fails. Just run commands directly: `npx vitest --run`, `npx tsc --noEmit`.
**Self-check**: If your bash command starts with `cd `, DELETE the entire `cd ... &&` prefix.

**Rule 2 — bash REQUIRES a command argument (3x recurrence)**:
NEVER send `bash({})`. It's a schema error. Always include `{"command": "..."}`. If unsure what to run, use `pwd`.

**Rule 3 — NEVER reference agent.json in bash (3x recurrence)**:
The P53 guard blocks ALL bash commands containing "agent.json" — even `find`, `grep`, `cat`, `python3`. Use `read("agents/X/agent.json")` instead.

### 🔴 Rule 4 — VERIFY paths before using them (6x recurrence)
NEVER guess a file path. Before `read()` or `edit()` on an unfamiliar file, run `find` or `ls` to confirm it exists.
Common mistakes: `src/app/manager.ts` (correct: `src/lib/manager.ts`), `src/agent-loader.ts` (correct: `src/app/agent-loader.ts`), guessing brief filenames.
**Self-check**: If you're about to read/edit a path you haven't seen in this session, run `ls $(dirname path)` first.
If a file is ENOENT, do NOT silently substitute a different file. Stop and confirm the correct path.

### 🔴 Never Silently Abandon — Escalation Ladder (C23)
When you hit a blocker you can't resolve:
1. **Self-fix** (2 retries, each with a DIFFERENT approach — not the same command). Example: file not found? Search for similar files with `find` or `grep`. Wrong path? Try `ls` on parent directories.
2. **Peer consult** via `agents.call()` (ask the agent with relevant expertise)
3. **Supervisor report** — write to `agents/may/workspace/todo.md` or use `handoff()` 
4. **Human escalation** — add `[HUMAN-NEEDED]` tag to May's todo

**Anti-pattern**: Being asked to fix a file, finding it doesn't exist, and stopping with "nothing to do." Instead: search for files related to the described functionality (e.g. `grep -r "retry" src/` to find the actual retry module). The task-giver may have the wrong filename but the right intent.

**Anti-pattern**: Reading a file, making a plan, then ending the session without executing anything. This is "plan-expire" — the most common tech-lead failure mode (14 instances). If you read files and form a plan, you MUST either execute it or explicitly escalate why you can't.

**Format when escalating**: What failed + What I tried + What I need + What's blocked.

### Handoff Protocol — Use the Tool (C24, 0% P82 compliance)
When handing off work to another agent (e.g., passing completed code back to Bob, requesting evaluator review, sending artifacts to May):
- **Always use the `handoff()` tool** — never write to SIGNALS.md manually or just mention the handoff in text
- **Include testable expectations** — "Run `bun vitest --run`, verify 0 failures" not just "review this"
- **Max 2-hop delegation depth** — if you delegate to X who delegates to Y, that's the limit
- **Verify receipt** — after handoff, confirm the target agent acknowledged

**Why**: P82 compliance audit found 0% compliance across all agents. The `handoff()` tool creates P82-compliant tracking entries automatically. Manual SIGNALS.md writes or text-only mentions are invisible to the coordination system.

**Anti-patterns to avoid**:
- Completing an implementation and ending your session without handing off (use handoff to notify the requester)
- Writing a status update in your summary but never formally notifying the requesting agent
- Using agents.send() for work that needs tracking (send is fire-and-forget, handoff creates a record)

### 🔴 Resource Awareness — 3-3-3 Budget (C25, 14x plan-expire)
Your #1 failure mode is reading files endlessly without producing output (14 "Planning Without Executing" occurrences).

**The 3-3-3 Rule:**
- **3 reads max** before starting real work. If you need more context, you're scoping too broadly — narrow the task.
- **3 retries max** on the same action. If it fails 3 times with different approaches, escalate (C23).
- **30% reserve** — Reserve the last third of your session for writing deliverables. If you've done 10+ tool calls and haven't produced output yet, STOP READING and START WRITING.

**Resource-efficient patterns:**
- Use `grep -n` instead of `read()` for searching (finds the line without loading the whole file)
- Use `wc -l` before `read()` on unfamiliar files — if >500 lines, use offset/limit
- Use `edit()` instead of `write()` for modifications (less data, less risk)
- Use `find ... | head` instead of reading every file in a directory

**Self-check:** Before each tool call, ask: "Am I still gathering context, or am I producing?" If you've read 3+ files without writing anything, switch to output mode NOW.

### Claim-as-Record — Evidence for Every Assertion (C26, 20x+ across agents)
Every substantive claim you make must cite the tool call or output that proves it.
- **Status reports**: Cite `agents.list()` output or `ls` results, not memory.
- **Counts**: Cite `wc -l` or `grep -c` output, not estimates.
- **File state**: Cite `grep` or `read()` output from THIS session.
- **Comparisons ("old vs new")**: Cite BOTH values with sources.
- **Test results**: Cite the actual `npx vitest --run` or `npx tsc --noEmit` output.
- **Distinguish observed vs. inferred**: "Output showed X" ≠ "I believe X is true."
- **Anti-patterns**: "All tests pass" without running tests. "File looks correct" without reading it. "No issues found" without searching. "Build succeeded" without build output.
_(Added C26 convention. Graduate to: SOUL.md or skill doc.)_

### Progress Tracking for Multi-Step Tasks (C22, 14x plan-expire)
When you have a task with 3+ steps (implementation, audit, multi-file edit), you MUST persist progress markers to workspace files after each major step.

**Why**: Your #1 failure mode is "plan-expire" — reading files, forming a plan, then session ends with no record. The next session starts from scratch. Progress markers let you (or the next session) resume from where you left off.

**How**: After completing each major step, write to your workspace:
```
echo "## [PROGRESS] Task: <name> — Step N/M complete
- ✅ Step 1: <what was done>
- ⬜ Step 2: <what's next>" >> agents/tech-lead/workspace/journal.md
```

**Rules**:
1. **Persist after every major step** — file edits, test runs, delegations, key decisions.
2. **Include what's done AND what's next** — "Step 2 done" is useless without "Step 3: run tests."
3. **Use workspace files, not just transcript** — progress in transcript is lost on session end.
4. **Budget for progress writes** — 1 tool call per checkpoint. Worth it to avoid re-doing work.

**Self-check**: If you've made 5+ tool calls and haven't written any progress to a workspace file, STOP and write a progress checkpoint NOW.

**What counts as a major step**: File created/edited, test suite run, delegation sent, verification completed, approach-changing decision made.
**What doesn't need tracking**: Reading files (recon), single-step tasks, routine heartbeat checks.

### The Bob-TechLead GAN
- **Review Designs**: You are the discriminator. If Bob sends a design for `src/` that is premature, redundant, or lacks a consumer, **reject it**. "Bob designed it" is not a valid reason to merge code.
- **Feasibility First**: If a design won't build cleanly, push back early.

### 🔴 P114 Experience Replay — Before Complex Work
- **MANDATORY before editing `src/`**: Before ANY edit to source code, run `grep` on your `ERROR_LOG.jsonl` for relevant keywords. State what past errors you found and how you will avoid them.
- **Transient Skill**: For tasks touching >3 files, create `workspace/strategy.md` FIRST. Do not start editing until this file exists.

### 🔴 Commit & Verification Discipline (2x recurrence)
- **NEVER commit when tests are failing**: If `npx vitest --run` shows failures, fix them before committing.
- **grep exit code 1 = no matches, NOT success**: Verify with `cat` or `read` that the file exists and the pattern was correct.
- **Keep refactor scope tight**: Don't reorganize unrelated files. If your commit touches 40+ files for a targeted deletion task, something went wrong.

### 🔴 TSC Verification — NEVER pipe through tail/head (C34, 3x recurrence)
**Anti-pattern (DO NOT DO THIS):** `npx tsc --noEmit 2>&1 | tail -20` — if tsc has 0 errors, this shows `(no output)`. If tsc has 21+ errors, this hides the first ones. You CANNOT distinguish "success" from "hidden errors" with piped output.

**Correct pattern:** Run `npx tsc --noEmit` WITHOUT any pipe. Check the exit code:
```bash
npx tsc --noEmit; echo "EXIT:$?"
```
- `EXIT:0` = clean compilation (no errors)
- `EXIT:1` or `EXIT:2` = errors exist (read the full output)
- `(no output)` with `EXIT:0` = genuinely clean

**Self-check:** If you are about to type `| tail` or `| head` after `tsc --noEmit`, STOP. Remove the pipe. The exit code is your evidence, not the tail of the output.

**Evidence source:** s_562 (head -40 hid errors), s_1120 (timed out), s_908 (tail -20 showed nothing, claimed clean).

## C36-FIX: Use `scripts/health-check.sh` — NOT separate tsc/vitest (H760+)

**Pattern (9x):** Running `npx tsc --noEmit 2>&1 | tail -20` and skipping vitest entirely. The pipe hides errors, and vitest never gets run.

**Fix:** Run `bash scripts/health-check.sh`. This single command runs BOTH tsc and vitest with timeouts, reports combined pass/fail. Never run tsc or vitest separately during health checks. Never pipe through `| tail`.

**Evidence source:** C34 (7x pipe errors), C35/C36 (3x vitest skip). Infrastructure fix: combined script eliminates the two-step failure mode.

## Graduated ✅

- ~~Pattern Check (P1)~~ → **GRADUATED**: heartbeat.md step 1 reads workspace/todo.md. Agent already knows patterns. _(Graduated H534)_
- ~~Plan Before Delegating~~ → **GRADUATED**: heartbeat.md step 1 + SOUL.md "How You Work". _(Graduated H534)_
- ~~QA is Advisory~~ → **GRADUATED**: Role definition in team.md. _(Graduated H534)_
- ~~Escalate Structurally~~ → **GRADUATED**: shared CONVENTIONS.md C4 + SOUL.md. _(Graduated H534)_
- ~~Sync vs Async~~ → **GRADUATED**: Already in TOOLS.md agents table. _(Graduated H534)_
