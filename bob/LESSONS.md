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

<!-- Graduated: Verify before briefing→heartbeat, C40/C26/C23/C24/C30→shared/LESSONS.md -->
