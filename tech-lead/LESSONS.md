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

<!-- Graduated: cd/bash-schema/agent.json→heartbeat P13, C40/C26/C23/C24/C25/C22→shared/LESSONS.md -->
