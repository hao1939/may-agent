# Unreviewed findings (QA heartbeat)

## Context
- `git log -10` shows a single recent commit: `3f031dd` adding 2 hypothesis markdown files under `.state/hypotheses/`.

## Evidence reviewed
- Read: `.state/hypotheses/h-exp-023-validated-tool-integration.md`
- (Did not yet read: `.state/hypotheses/h-exp-027-environmental-constraints.md`)

## Checks
- `./node_modules/.bin/tsc --noEmit`: **FAIL** in this environment because there is **no `tsconfig.json`** at repo root; `tsc` prints help and exits code 1.
- `./node_modules/.bin/vitest --run`: **FAIL** because `./node_modules/.bin/vitest` is missing (exit code 127).

## Findings
### IMPORTANT — CI/tooling configuration mismatch
This repo appears to be a minimal root without a TS project or vitest installed, but QA guardrails require running `tsc` + `vitest`. Either:
1) install/configure these at root (add `tsconfig.json`, add `vitest` dep), or
2) update QA instructions for this repo to run the correct commands for the actual project structure.

### MINOR — Documentation-only change
Commit `3f031dd` adds hypothesis documentation under `.state/` only; no code risk observed from the one file reviewed.
