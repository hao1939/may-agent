# Brief: Fix Critical Context Gap (Migrate LESSONS.md)

**Problem:**
The agent runtime (`src/lib/manager.ts`) currently excludes `LESSONS.md` from the system prompt to save tokens, assuming all lessons were migrated to `SOUL.md`. However, an audit reveals that `agents/*/LESSONS.md` still contain critical, unmigrated behavioral corrections (e.g., `agents/optimizer/LESSONS.md` has 4 active band-aids).
- **Impact:** Agents are repeating known failures (FM-2.4, FM-2.6) because the "Band-Aid" lessons are invisible to them.
- **Root Cause:** Premature optimization in `manager.ts` removed `LESSONS.md` loading before the migration was complete.

**Solution:**
1. **Short-term (Hotfix):** Restore `LESSONS.md` loading in `src/lib/manager.ts` (behind `DOMAIN.md` logic).
2. **Long-term (Consolidation):** Coach/Optimizer must aggressively migrate valid lessons to `SOUL.md` or `common-sense.md` and delete the file.

**Implementation Plan (Tech-Lead):**
1. **Edit `src/lib/manager.ts`**:
   - Locate the `buildSystemPrompt` function.
   - Restore the `loadFile` call for `LESSONS.md` (similar to how `DOMAIN.md` was restored).
   - Insert it after `DOMAIN.md` in the prompt sequence.

**Verification:**
1. Run `bun src/app/may.ts --oneshot --agent optimizer --task "echo hello"`
2. Verify in the debug output (or by asking the agent) that it knows its specific lessons (e.g., "FM-2.4").

**Request ID:** [generate-id]
