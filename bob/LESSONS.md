# Lessons

_Staging area for behavioral fixes. Each entry should graduate into structure (heartbeat.md, DOMAIN.md, SOUL.md) within 2 weeks, then be deleted._

## Active Band-Aids

### Escalation Protocol — Never Silently Abandon (C23, 10x+ across agents)
When you hit a blocker (ENOENT, tool failure, permission denied, repeated errors):
1. **Self-fix** (2 retries, different approach each time)
2. **Peer consult** via `agents.call()` — ask tech-lead or another agent for help
3. **Supervisor report** via `handoff()` or May todo — include: what failed, what was tried, what's needed
4. **Human escalation** with `[HUMAN-NEEDED]` tag if all else fails

**NEVER** silently stop working without reporting what went wrong. A blocker report is more valuable than silence. If a brief references a missing file, try `find` or `ls` to locate it before giving up. If delegation fails twice, decompose the task or reroute to a different agent.

### Handoff Protocol — Use the Tool (C24, 0% P82 compliance)
When handing off work to another agent asynchronously (e.g., writing a brief for tech-lead, requesting May dispatch something, passing an artifact to evaluator):
- **Always use the `handoff()` tool** — never write to SIGNALS.md manually or just mention the handoff in text
- **Include testable expectations** — "Run `tsc --noEmit`, verify 0 errors" not just "review and fix"
- **Max 2-hop delegation depth** — if you delegate to X who delegates to Y, that's the limit
- **Verify receipt** — after handoff, confirm the target agent acknowledged

**Why**: Your own P82 compliance audit found 0% compliance across all agents. The `handoff()` tool creates P82-compliant tracking entries automatically. Manual SIGNALS.md writes or text-only mentions are invisible to the coordination system.

**Anti-patterns to avoid**:
- Writing a brief file and assuming someone will find it (use handoff to notify)
- Saying "May should dispatch this" in your summary without actually using handoff()
- Delegating via agents.send() when the work needs tracking (send is fire-and-forget, handoff creates a record)

### Idempotent Handoffs — Check Before Sending (C27, 56+ duplicates observed)
Before sending ANY handoff or brief to another agent:
1. `grep` the artifact filename in the target's `workspace/todo.md` — if already present, **skip the handoff**
2. `grep` the artifact in `SIGNALS.md` — if already ACKed/PROCESSED, **skip**
3. Only send if neither check finds a prior entry

**Why**: You have sent the same `security-gap-reality-check.md` handoff 8 times to tech-lead across different heartbeats. Tech-lead's todo.md has 56+ "Duplicate" entries from you. Each duplicate wastes the receiver's processing capacity and adds noise.

**Root cause**: Each heartbeat session starts fresh. You re-discover the same issue, generate the same handoff, without checking if a prior session already sent it.

**Anti-patterns**:
- Discovering an issue and immediately handoffing without checking prior state
- Assuming this is the first time you're seeing a finding (it probably isn't)
- Not reading the target's todo.md before adding to their workload

### Idempotent Self-Work — Check Done Items Before Re-Verifying (C28, 6+ sessions)
Before verifying or investigating ANY issue (P161, P110, P209, or anything else):
1. `grep` the item in YOUR OWN `workspace/todo.md` — if marked `[x]`, **skip it**
2. `grep` the item in `focus-tasks.md` — if marked `**[VERIFIED]**` or `**COMPLETED**`, **skip it**
3. Only investigate/verify if the item is still open/unchecked

**Why**: You have re-verified "P161 Security Gap is Closed" in 6+ consecutive heartbeat sessions despite it being marked `[x]` done in your todo.md. You re-checked P110/P209 "Implementation Gaps" 5+ times despite marking them `[VERIFIED]` in focus-tasks.md. Each re-verification wastes 3-6 tool calls per heartbeat.

**Root cause**: Each heartbeat starts fresh. You scan focus-tasks.md, see items like P161/P110/P209, and re-verify them without noticing they're already marked done. Your own prior work is invisible to you.

**Fix**: At the START of each heartbeat, after reading focus-tasks.md, grep for `[x]`, `VERIFIED`, `COMPLETED` status markers. Only work on items that are NOT yet marked done. Treat your own prior annotations as authoritative.

**Anti-patterns**:
- Running `ls src/lib/tools/security.ts` to "verify P161" when focus-tasks.md already says `**[VERIFIED]**`
- Checking if `reflect.ts` exists when todo.md already has `[x] Monitor Reflect System`
- Re-discovering that P110/P209 are "false positives" every heartbeat

### Safe File Appending — Never write() an Append-Only File (C30, 4x in last 30 sessions)
When adding content to an existing file (journal.md, todo.md, changelog, any growing document):
1. **Use `bash`**: `cat >> file <<'EOF'` to append new content
2. **Or use `edit()`**: with `oldText` targeting the last few lines, `newText` = those lines + new content
3. **NEVER use `write()`** on a file that already has content you want to keep

**Why**: `write()` **replaces the entire file**. When you call `write("journal.md", "## New Entry...")`, it destroys all 1000+ lines of prior journal entries. You've done this 4 times recently on journal.md (s_293, s_286, s_284, s_267). You only avoided data loss because System Busy rejected the `write()` calls and you fell back to `cat >>`. **That's luck, not safety.**

**Quick check**: Before writing to ANY file, ask: "Does this file already exist with content I want to keep?" If yes → `cat >>` or `edit()`. If no (new file) → `write()` is fine.

**Anti-patterns**:
- `write("journal.md", "## New Entry\n...")` — destroys entire journal
- Assuming `write()` appends (it doesn't — it replaces)
- Retrying `write()` 3 times when it fails, hoping it works (each attempt would destroy the file)
- Not checking file size/existence before choosing write method

### Claim-as-Record — Evidence for Every Assertion (C26, 20x+ across agents)
Every substantive claim you make must cite the tool call or output that proves it.
- **Status reports**: Cite `agents.list()` output or `ls` results, not memory.
- **Counts**: Cite `wc -l` or `grep -c` output, not estimates.
- **File state**: Cite `grep` or `read()` output from THIS session — never claim a file's contents from memory.
- **Comparisons ("old vs new")**: Cite BOTH values with sources.
- **Audit findings**: Cite the specific file/line where the violation was found, not just "found compliance gaps."
- **Distinguish observed vs. inferred**: "grep output showed X" ≠ "I believe X is true."
- **Anti-patterns**: "All agents comply" without checking each agent. "Brief delivered" without verifying the file was written. "No issues found" without searching.
_(Added C26 convention. Graduate to: SOUL.md or skill doc.)_

### Write-Before-Handoff Sequencing — Never Batch write() and handoff() Together (C31, 3x observed)
When creating a file and handing it off to another agent:
1. **First batch**: Call `write()` to create the file. Wait for the result.
2. **Second batch**: Call `handoff()` to notify the target agent. The file now exists.
3. **NEVER** put `write()` and `handoff()` in the same parallel batch.

**Why**: The `handoff()` tool validates that the artifact file exists (via `existsSync()`). When `write()` and `handoff()` execute concurrently in the same batch, the `handoff()` may run BEFORE `write()` finishes — causing "artifact does not exist" failures. You've done this 3 times (s_826: 3 handoffs + 4 writes in same batch, all handoffs failed; s_149, s_239: same pattern).

**Root cause**: You naturally batch independent-looking tool calls for efficiency. But `write()` and `handoff()` on the SAME file have a hidden dependency — the handoff needs the write to complete first.

**Quick check**: Before batching tool calls, ask: "Does any call in this batch depend on a side effect of another call?" If yes → split into sequential batches.

**Anti-patterns**:
- Batching `write("brief.md", ...)` + `handoff("tech-lead", "brief.md", ...)` in one tool call block
- Assuming all tool calls in a batch are truly independent
- Retrying failed handoffs without realizing the file write hasn't completed yet

## Graduated (delete after confirming structural fix works)

- ~~Verify before briefing~~ → **GRADUATED H535**: heartbeat.md step 2 now requires `read` of target file before requesting changes.

### Promise-Deliver-Report — Track What You Commit To (C40)
Every heartbeat session must follow this pattern:
1. **Promise**: State numbered deliverables BEFORE doing any work ("This heartbeat I will: 1. ... 2. ... 3. ...")
2. **Deliver**: Execute the promised work
3. **Report**: End with numbered results matching each promise (✅ delivered / ❌ not delivered + reason)

**Why**: Without explicit promises, sessions drift into ad-hoc exploration and end with vague summaries. The user can't verify what was planned vs. what was achieved. Explicit tracking catches scope creep and makes incomplete work visible.

**If priorities change mid-session**: Declare "PIVOT: [old] → [new] + reason". This keeps the contract visible.

**Anti-patterns**:
- Starting work immediately without stating promises
- Ending with "What I Did" that doesn't map to stated promises
- Silently dropping a promise without ❌ explanation
