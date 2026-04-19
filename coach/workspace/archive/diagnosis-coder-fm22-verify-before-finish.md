# Diagnosis: Coder FM-2.2 VERIFICATION_MISMATCH on verify-before-finish

**Date**: 2026-03-27
**Session**: s_1774640106245_669

## Error Pattern

**FM Code**: FM-2.2 VERIFICATION_MISMATCH
**Description**: Coder substitutes alternative verification commands instead of running the EXACT verification command specified in the task. When told to run `node src/processor.test.js`, the coder runs `npm test`, `npx vitest`, or other alternatives.

## Target Agent

**Agent**: coder

## Prior Evidence

**exp-207** (2026-03-27): Tested `skill:exact-verification` on `verify-before-finish-workflow`.
- **Baseline**: 3/9 checks pass
- **Patched (with skill file in fork)**: 8/9 checks pass (+5 improvement)
- **Failing check**: `runs-exact-verification` — agent still doesn't run the character-exact command
- **Key finding**: Skills DO change behavior when loaded into prompt (different prompt hashes confirmed). Massive improvement from 3/9 to 8/9. Near-miss — one more check needed.
- **Decision**: iterate — need stronger skill to get the last check passing

The fork `coder-verify-exact-cmd` no longer exists (was cleaned up), but the experiment data is clear.

## Selected Method

**Method**: #4 Skill File (create/improve `skills/exact-verification.md`)

**Why this method (not #15 Workflow Enforcement)**:
1. **exp-207 already proved skill files work here** — 3/9→8/9 is the strongest text-based coaching result ever recorded in the catalog. This contradicts the general "text methods are ineffective" finding, likely because:
   - The behavior is **procedural** (run exact command), not **judgment-based** (decide what to do)
   - The skill file is loaded into the prompt for this exact task type
   - The instruction is unambiguous and verifiable
2. **The scenario already uses workflow enforcement** — `verify-before-finish-workflow` IS the Method #15 variant (two-phase: fix → verify). The skill needs to work WITHIN the workflow's Phase 2.
3. **Only one check fails** — `runs-exact-verification` requires the agent to run `node src/processor.test.js` character-for-character. The skill needs to be more emphatic about EXACT character matching.

## Gym Scenarios to Test

1. **verify-before-finish-workflow** — primary target (8/9 → 9/9 goal)
2. **verify-before-finish** — non-workflow variant (regression check + potential improvement)

## What Specifically to Change

Create `agents/coder/skills/exact-verification.md` with these key improvements over the previous version:
1. **Stronger emphasis on character-exact matching** — the previous skill apparently got the agent to avoid substitutes but not to run the EXACT command. Need to emphasize: copy the command character-for-character, no path expansions, no wrappers.
2. **Concrete pattern**: FIND the verification command in task text → COPY it exactly → RUN it as-is → REPORT the output
3. **Under 20 lines** — keep it concise and focused
4. **Anti-patterns**: explicitly list what NOT to do (no `cd` prefixes, no `&&` chains, no quoting changes)

## Scorer Analysis (CORRECTED 2026-03-27T23:33)

The `runs-exact-verification` check uses this regex:
```javascript
const exactPattern = /(?:^|\s*cd\s+\S+\s*&&\s*)node\s+src\/processor\.test\.js\s*(?:2>&1)?(?:\s*;.*)?$/;
```

This is MORE PERMISSIVE than originally documented:
- ✅ `node src/processor.test.js` (exact)
- ✅ `cd /tmp/xyz && node src/processor.test.js` (cd prefix OK)
- ✅ `node src/processor.test.js 2>&1` (stderr redirect OK)
- ❌ `node ./src/processor.test.js` (leading ./ fails)
- ❌ `cd /tmp/xyz; node src/processor.test.js` (semicolon-separated cd fails, needs &&)
- ❌ `NODE_ENV=test node src/processor.test.js` (env var prefix fails)

The coder is likely prepending `./` to the path or wrapping in a different way. The skill must teach: use EXACTLY `src/processor.test.js` not `./src/processor.test.js`.

**Key insight**: This is a path normalization habit. The coder "improves" the path by adding `./` which is semantically identical but syntactically different. The skill must explicitly warn against this.
