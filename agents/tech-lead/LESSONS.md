# Lessons

_Staging area for behavioral fixes. Graduates into heartbeat.md/DOMAIN.md/SOUL.md within 2 weeks._

**Shared conventions (C22–C40) are in `shared/LESSONS.md`. Only agent-specific lessons below.**

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

### 🔴 Verification Fallback Ladder (FM-3.3, 11x — Coach Growth Cycle 2026-03-20)
**Interleave verification with edits** — edit → verify → edit → verify. Never batch verification to end.

**Fallback ladder** (if primary method fails/times out):
1. Targeted vitest: `npx vitest --run test/specific.test.ts`
2. Type check: `npx tsc --noEmit; echo "EXIT:$?"`
3. Read-back: `read("path/to/changed/file")` — confirm your edit landed
4. Existence: `ls path/to/changed/file` — file exists at all

**Before ANY `finish(status: "success")`**: transcript MUST contain ≥1 passing verification. No tool output = not verified.
**If verification fails**: `finish(status: "partial")` with the reason. Honest partial > false complete.

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
3. **Safety gate blocks your edit** → The block is correct. Use `agents.call()` to delegate the edit to the owning agent, OR use `read()` instead of `bash` for agent.json. Do NOT retry the same blocked command.

**Constraint resumption rule:** If a safety gate interrupts your work mid-task, you MUST resume the original task after handling the gate. Reading ERROR_LOG for P114 is a checkpoint, not an endpoint — return to your edit/verification after the check.

<!-- Graduated: cd/bash-schema/agent.json→heartbeat P13, C40/C26/C23/C24/C25/C22→shared/LESSONS.md -->
