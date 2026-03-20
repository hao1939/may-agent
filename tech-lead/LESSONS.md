# Lessons

_Staging area for behavioral fixes. Graduates into heartbeat.md/DOMAIN.md/SOUL.md within 2 weeks._

**Shared conventions (C22–C40) are in `agents/shared/LESSONS.md`. Only agent-specific lessons below.**

## Active Band-Aids

### 🔴 Tool Call Argument Integrity (FM-2.5: 11x in Mar 14-17, Coach Growth Cycle 2026-03-20)
Before EVERY tool call, mentally read back your arguments object. The following are SCHEMA ERRORS that waste a turn:
- `bash({})` → WRONG. Must be `bash({"command": "..."})`.
- `read({})` → WRONG. Must be `read({"path": "..."})`.
- `write({})` → WRONG. Must be `write({"path": "...", "content": "..."})`.
- `edit({"limit": ..., "offset": ...})` → WRONG. edit takes `path`, `oldText`, `newText`. Never `limit`/`offset`.
- `bash({"path": "...", "content": "..."})` → WRONG. bash takes `command`, not `path`/`content`.
- `agents({})` → WRONG. Must include `{"action": "..."}`.

**Concrete recent failures**: Sessions s_1773515749174_562 (2x `bash({})`), s_1773575769880_1161 (4 invalid calls in one session), s_1773578929130_16 (`edit` with `limit/offset`). All wasted turns and triggered evaluator flags.

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

### 🔴 FM-2.2 Command Failure Recovery — Exit Codes Are Data, Not Noise (Coach Growth Cycle 2026-03-20, 11x FM-2.2)
When a command returns non-zero or unexpected output, you MUST interpret it before proceeding:

**Exit code cheat sheet:**
| Exit code | Meaning | Correct response |
|-----------|---------|-----------------|
| 0 | Success | Proceed with output |
| 1 (grep/find) | No matches found | This is INFORMATION, not failure. State "no matches" and adjust search or move on |
| 1 (other) | General error | Read stderr, diagnose, fix |
| 123 (xargs) | Some commands failed | Check which ones failed, don't ignore |
| 126/127 | Command not found / not executable | The tool/command doesn't exist — do NOT retry, find alternative |

**Failure→Recovery mappings (3 most common FM-2.2 patterns):**
1. **grep returns code 1** → Say "no matches found for X" → Broaden search (`grep -ri`, different path) or conclude the pattern doesn't exist. Do NOT leave as unresolved.
2. **Tool doesn't exist** (e.g., `system_status`, `discard_agent`) → STOP. Check `TOOLS.md` for available tools. Use `bash` + standard commands instead of hallucinated tools.
3. **P53/safety blocks your edit** → The block is correct. Use `agents.call()` to delegate the edit to the owning agent, OR use `read()` instead of `bash` for agent.json. Do NOT retry the same blocked command.

**Constraint resumption rule:** If a safety gate (P53, P114) interrupts your work mid-task, you MUST resume the original task after handling the gate. Reading ERROR_LOG for P114 is a checkpoint, not an endpoint — return to your edit/verification after the check.

<!-- Graduated: cd/bash-schema/agent.json→heartbeat P13, C40/C26/C23/C24/C25/C22→shared/LESSONS.md -->
