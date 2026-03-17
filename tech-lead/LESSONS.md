# Lessons

_Staging area for behavioral fixes. Each entry should graduate into structure (heartbeat.md, DOMAIN.md, SOUL.md) within 2 weeks, then be deleted._

**Shared conventions (C22–C40) are in `agents/shared/LESSONS.md`. Only agent-specific lessons below.**

## Active Band-Aids

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

## C36-FIX: Use `scripts/health-check.sh` — NOT separate tsc/vitest

**Pattern (9x):** Running `npx tsc --noEmit 2>&1 | tail -20` and skipping vitest entirely. The pipe hides errors, and vitest never gets run.

**Fix:** Run `bash scripts/health-check.sh`. This single command runs BOTH tsc and vitest with timeouts, reports combined pass/fail. Never run tsc or vitest separately during health checks. Never pipe through `| tail`.

<!-- Graduated: Pattern Check→heartbeat, Plan Before Delegating→heartbeat+SOUL, QA Advisory→team.md, Escalate→CONVENTIONS, Sync/Async→TOOLS, C40/C26/C23/C24/C25/C22→shared/LESSONS.md -->
