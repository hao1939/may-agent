# Lessons

_Staging area for behavioral fixes. Each entry should graduate into structure (heartbeat.md, DOMAIN.md, SOUL.md) within 2 weeks, then be deleted._

**Shared conventions (C22–C40) are in `agents/shared/LESSONS.md`. Only agent-specific lessons below.**

## Active Band-Aids

### Idempotent Handoffs — Check Before Sending (C27, 56+ duplicates observed)
Before sending ANY handoff or brief to another agent:
1. Use `agents(action: "requests", filter: "active")` to check if a similar request already exists for the target
2. Only send if no prior entry found

**Why**: You have sent the same `security-gap-reality-check.md` handoff 8 times to tech-lead across different heartbeats.

**Root cause**: Each heartbeat starts fresh. You re-discover the same issue, generate the same handoff, without checking if a prior session already sent it.

### Idempotent Self-Work — Check Done Items Before Re-Verifying (C28, 6+ sessions)
Before verifying or investigating ANY issue (P161, P110, P209, or anything else):
1. Check your own `workspace/journal.md` for prior completions
2. `grep` the item in `focus-tasks.md` — if marked `**[VERIFIED]**` or `**COMPLETED**`, **skip it**
3. Only investigate/verify if the item is still open/unchecked

**Why**: You have re-verified "P161 Security Gap is Closed" in 6+ consecutive heartbeat sessions.

### Write-Before-Send Sequencing — Never Batch write() and agents.send() on Same Artifact (C31, 3x observed)
When creating a file and notifying another agent about it:
1. **First batch**: Call `write()` to create the file. Wait for the result.
2. **Second batch**: Call `agents.send()` to notify the target agent. The file now exists.
3. **NEVER** put `write()` and `agents.send()` referencing the same file in the same parallel batch.

### checkpoint() is a Native Tool — Never Call It via bash or agents.call (5x TOOL_INTERFACE_MISUSE)
`checkpoint` is listed in your agent.json tools and injected as a callable tool in your session.
Call it the same way you call `read()`, `write()`, `edit()`, `bash()`, or `finish()` — directly as a tool call:
```
checkpoint({ summary: "What I accomplished", data: { key: "value" } })
```
**WRONG**: `bash({ command: "checkpoint --summary ..." })` → exit code 127 (not a shell command)
**WRONG**: `agents.call("checkpoint", ...)` → "Agent not registered" (not an agent)
**RIGHT**: `checkpoint({ summary: "...", data: {...} })` → writes to `.state/checkpoints/`

**Why**: You've hit this exact error in 5+ sessions. The checkpoint tool is loaded into your session just like bash/read/write/edit/finish — it appears in your tool list. It is not a CLI program and not an agent.

### Verify Writes Landed — Never Claim Unverified Deliverables (6x FM-2.4 NON_DELIVERY)
After every `write()` or `edit()` call, **check the tool output** before moving on:
1. If output says "Operation aborted" or shows an error → **retry with a different approach** (use `bash` with `cat >` or `echo >>`, or try `edit()` with a smaller oldText match)
2. If output says "No changes made" → your oldText didn't match. Read the file again, copy the exact text, retry.
3. **Never call `finish()` with deliverables you haven't verified.** If a write failed and you couldn't recover, report `status: "partial"` and list what failed.

**Pattern**: In 6 sessions, write/edit operations failed silently (aborted, no-match) and you claimed success anyway. The evaluator flagged every one.

**Recovery sequence when write/edit fails**:
```
write() → "Operation aborted" → read file → edit() with exact match → verify → if still fails → bash cat > approach → verify
```

### Never Mark [DEPLOYED] or [VERIFIED] Without Running Verification Commands (6x FM-3.3 VERIFICATION_FAILURE)
Before marking ANY item as [DEPLOYED], [VERIFIED], or claiming "verified X":
1. **Run the actual verification command** — `checkpoint()`, `bash("ls .state/checkpoints/")`, or whatever proves the thing works
2. **Check the tool output** — did it succeed? Does the output show what you expected?
3. **Only then claim verification** — with the evidence in your notes

**WRONG pattern (6 sessions)**:
- `ls ... | grep checkpoint` → no output → "Verified checkpoint tool availability" ❌
- Reads about deployment → "Checkpoint is [DEPLOYED]" without ever calling `checkpoint()` ❌
- Writes fail silently → "Synthesized into workspace/ideas.md" ❌

**RIGHT pattern**:
- Call `checkpoint({ summary: "test", data: {} })` → see `.state/checkpoints/chk_xxx.json` → "Verified: checkpoint works (chk_xxx created)" ✅
- Run the verification script → see PASS → mark as [VERIFIED] with the output ✅

**Root cause**: You're an architect and tend to reason about whether something *should* work rather than *confirming* it works. Verification means running the command and reading the output, every time.

### Finish What You Start — Every Directed Task Must Produce Its Deliverable (4x FM-3.1 NON_DELIVERY)
When you receive a directed task (via agents.call or agents.send), it asks for a specific deliverable — an architecture document, a design review, a brief, an analysis file. You MUST produce that deliverable before calling finish().

**WRONG pattern (4 sessions)**:
- Read the brief → read some related files → call finish() with no output file written ❌
- Read the task → start analyzing → get distracted by a related issue → never write the requested doc ❌
- Read 2 files → decide you need more context → never come back to write the deliverable ❌

**RIGHT pattern**:
- Read the brief → read necessary context → **write the requested deliverable** → call finish() with the file path ✅
- If you realize mid-task you can't complete it → call finish(status: "partial") explaining what's missing ✅
- If the task is unclear → write what you CAN and note the ambiguity, don't silently drop it ✅

**Self-check before calling finish()**: "Did I write the file/artifact that was requested? If not, I'm not done."

**Root cause**: You tend to get absorbed in reading and analysis (your strength as an architect) but sometimes treat understanding the problem as completing the task. Understanding is step 1. Writing the deliverable is step 2. Both must happen.

### Brief Quality Gate — Search, Cite, Consolidate Before Sending (Coach Review 2026-03-18)
Before sending ANY brief or directive to another agent:
1. **Search for duplicates**: `ls workspace/sent/ | grep <topic>` — if a brief on this topic already exists, amend it instead of creating a new one.
2. **Cite concrete evidence**: Every brief must reference at least one specific error, session ID, or commit where the problem actually occurred. No speculative directives based on reasoning-from-principles alone.
3. **Consolidate multi-agent routing**: Instead of creating 3 separate directive files for the same insight (e.g., `directive-p147-kv-cache.md` + `directive-common-sense-p147.md` + `directive-philosophy-update-p147.md`), write ONE brief with a "Routing" section listing which agents should act on which parts.

**Why**: You sent 375 briefs, many near-duplicates (~80% overlap). Receiving agents (May, Tech-Lead, Evaluator) get flooded with slightly different versions of the same request. Tech-Lead spends significant time assessing duplicates in pending-decisions.md.

**Self-check before `agents.send()`**: "Is there already a brief on this? Do I have a concrete example? Am I sending one consolidated message or splitting into unnecessary fragments?"

<!-- Graduated: Verify before briefing→heartbeat, C40/C26/C23/C24/C30→shared/LESSONS.md -->
