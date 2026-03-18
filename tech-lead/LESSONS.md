# Lessons

_Staging area for behavioral fixes. Graduates into heartbeat.md/DOMAIN.md/SOUL.md within 2 weeks._

**Shared conventions (C22–C40) are in `agents/shared/LESSONS.md`. Only agent-specific lessons below.**

## Active Band-Aids

### 🔴 Path & Tool Hygiene (see also heartbeat P13)
- NEVER guess file paths. Run `ls $(dirname path)` before read/edit on unfamiliar paths.
- Common wrong paths: `src/app/manager.ts` → `src/lib/manager.ts`, `src/agent-loader.ts` → `src/app/agent-loader.ts`.
- `grep` exit code 1 = no matches, NOT success. Verify with `cat`/`read`.

### The Bob-TechLead GAN
- You are the discriminator. If Bob sends a design that is premature, redundant, or lacks a consumer, **reject it**.

### 🔴 P114 Experience Replay — Before Complex Work
- Before ANY edit to `src/`, grep `ERROR_LOG.jsonl` for relevant keywords.
- For tasks touching >3 files, create `workspace/strategy.md` FIRST.

### 🔴 TSC Verification — No Pipes (C34)
Run `npx tsc --noEmit; echo "EXIT:$?"` — never pipe through `tail`/`head`. Use `scripts/health-check.sh` for combined tsc+vitest.

### 🔴 Commit Discipline
- NEVER commit when tests are failing.
- Keep refactor scope tight — if your commit touches 40+ files for a targeted task, something went wrong.

### 🔴 Verify-then-Claim Rule — Never Mark DONE Without Tool Output Evidence (Coach Review 2026-03-18, 11x FM-3.3)
Before marking ANY task as [DONE], [COMPLETED], or calling `finish()` claiming success:
1. **Run a verification command** — `bash("ls <expected_file>")`, `bash("grep <expected_content> <file>")`, `bash("npx tsc --noEmit")`, etc.
2. **Read the tool output** — does it confirm what you're claiming? If the command returns an error or empty output, the task is NOT done.
3. **Paste or reference the evidence** — in your finish() summary or task notes, cite the verification output.

**"Verified" means "I have tool output proving it."** Not "I believe it should work" or "I wrote the code."

**WRONG patterns (from 69 errors, FM-3.3 #1 at 11x)**:
- Wrote a fix → `finish(status: "success")` without running tests ❌
- Ran `grep` → got exit code 1 (no matches) → treated as success ❌  
- Called `edit()` → didn't check if "No changes made" → claimed done ❌

**RIGHT patterns**:
- Wrote a fix → `bash("npx tsc --noEmit; echo EXIT:$?")` → EXIT:0 → `finish(status: "success", deliverables: [...])` ✅
- Ran `grep` → no matches → investigated why → found the real path → verified ✅
- Called `edit()` → saw "No changes made" → re-read file → found exact text → retried → confirmed change ✅

**If verification fails**: Mark as `[BLOCKED]` with the reason, not `[DONE]`. Call `finish(status: "partial")` explaining what failed verification. Honest partial completion > false complete.

**Root cause**: You optimize for speed (18 completed items in one day — impressive throughput), but speed without verification creates rework. One verified delivery > three unverified claims.

<!-- Graduated: cd/bash-schema/agent.json→heartbeat P13, C40/C26/C23/C24/C25/C22→shared/LESSONS.md -->
