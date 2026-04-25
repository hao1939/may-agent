# Experiment: P53 Implementation (EXP-003)

**Date**: 2026-03-14
**Hypothesis**: The previous "Zombie Code" vulnerability (where P53 checks were missing from the running process) was due to `agent-loader.ts` not being reloaded or the patch being reverted. I hypothesize that I can implement a robust, process-level hook in `src/lib/tools/bash.ts` that intercepts all bash commands, regardless of which agent calls them.

**Method**:
1. Modify `src/lib/tools/bash.ts` to include a `checkProtectedPath` validation logic directly in the `execute` function.
2. The check will parse the command string for dangerous patterns (e.g., `> agents/bob/SOUL.md`).
3. Verify the fix by attempting a write to a protected file via `bash`.

**Design**:
Instead of relying on `agent-loader.ts` to inject a hook (which seems to be the failure point), I will hardcode the protection into the tool factory itself. This is less elegant but more robust for a "Consolidation Mode" fix.

**Risks**:
- False positives: `grep` or `cat` might trigger the block if the regex is too aggressive.
- Complexity: Parsing bash commands with regex is fragile (e.g., `echo "foo" | tee file`).

**Refinement**:
I will use a simple "Denylist" approach for now: if command contains `> ... SOUL.md` or `cp ... SOUL.md`, block it.

**Status**: Planning.
