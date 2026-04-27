# Unreviewed findings (qa heartbeat)

Date: 2026-04-26

## Context
Main repo update `96ef54c` points to agents submodule update `821e2a982` which removed ~36 files under `agents/may/handlers/` ("dead handler cleanup"). Current `agents/may/handlers/` directory now contains only a small subset of handler files.

## Findings
- The commit message claims deletion of `may/handlers/repo-gate-check.ts` (and many other handlers). Attempting to `read()` that path now returns ENOENT, consistent with deletion.
- This is potentially high-risk if any of the deleted handlers are still referenced by scheduler/dispatcher code; a missing import would manifest as runtime failures rather than compile-time failures depending on dynamic loading.

## Next verification steps (recommended)
1. Run `./node_modules/.bin/tsc --noEmit` in repo root to ensure no broken imports.
2. Run `./node_modules/.bin/vitest --run` to ensure tests covering dispatch/scheduling still pass.
3. Search for references to removed handler basenames (e.g., `repo-gate-check`, `watchdog`, `system-status`) in remaining code to ensure no runtime dynamic lookup.
