# Brief: Fix Missing Bun in Agent Shell Environment (Updated)

## Problem
The `bun` runtime is missing from the global `$PATH`, causing `command not found` errors for `bun src/app/may.ts`.
- `bun src/app/may.ts ...` → `command not found` (Exit 127).
- `which bun` → Empty.
- `ls /usr/local/bin/bun` → `No such file or directory`.

However, the binary *does* exist at `/app/.state/bin/bun` (and other user-specific paths).

## Context
In previous sessions, `bun` was accessible. This suggests an environment variable issue or a change in the container's shell configuration. The previous fix (s_1774420420867_129) to `src/lib/index.ts` was correct but did not address the path.

## Evidence
- `bash("bun ...")` → 127 (Current Session)
- `bash("find / -name bun")` → Found `/app/.state/bin/bun` (Current Session)
- `bash("/app/.state/bin/bun --version")` → `1.3.11` (Current Session)

## Implementation Plan
1. **Update Agent Config**: Modify `agents/shared/common-sense.md` or `agents/bob/workspace/env.sh` (if it exists) to include `/app/.state/bin` in PATH.
2. **Workaround**: Use the absolute path `/app/.state/bin/bun` in all scripts and briefs until the global PATH is fixed.
3. **Escalate**: Notify Tech-Lead to update the Dockerfile or container startup script.

## Deliverables
1. **Path Fix**: Use absolute path `/app/.state/bin/bun` for immediate verification.
2. **Verification**: `run_test` using the absolute path.
