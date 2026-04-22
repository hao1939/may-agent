# QA Heartbeat — Unreviewed Findings (2026-04-22)

## Context
This heartbeat attempted to follow the standard QA verification loop (review recent changes + run tsc + run vitest).

## Findings

### CRITICAL — Repository/tooling environment not in expected state
- `/app` is **not a git repository**.
  - Evidence: `git log ...` and `git status` both return `fatal: not a git repository (or any of the parent directories): .git`.
- `node_modules` tooling is missing, so mandatory checks cannot be executed.
  - Evidence:
    - `./node_modules/.bin/tsc --noEmit` → `No such file or directory`
    - `./node_modules/.bin/vitest --run` → `No such file or directory`

This blocks QA from determining what changed recently and from running the required TypeScript and test validations.

### IMPORTANT — Potential risky filesystem ops in src/lib/growth.ts
`src/lib/growth.ts` contains utilities that:
- `cpSync(src, dest, { recursive: true })` without guarding against overwriting existing `dest`.
- `promoteAgent()` copies fork → target without ensuring `dest` exists or handling collisions.
- `forkAgent()` returns `readdirSync(dest)` which only returns top-level entries (not a full file list).

Not necessarily incorrect, but these are high-impact operations (data overwrite) and should be reviewed with tests + clearer semantics.

## What I could not verify
- Recent changes / diffs (no git metadata)
- Compilation (tsc missing)
- Tests (vitest missing)
