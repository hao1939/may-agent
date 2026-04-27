# Unreviewed findings (QA heartbeat)

## Context
- Heartbeat date: 2026-04-27
- `git status` shows the `agents` entry modified, and many untracked files under `.state/` plus `node_modules/`.

## Findings
### CRITICAL — repo structure/submodule inconsistency
- Evidence:
  - `git diff` shows `agents` is recorded as a gitlink (mode 160000) but points to `93cd683...-dirty` rather than a clean commit, suggesting a submodule-like setup.
  - `git submodule status` fails: `fatal: no submodule mapping found in .gitmodules for path 'agents'`.
- Impact:
  - Breaks reproducibility and reviewability; a dirty gitlink can’t be fetched/checked out reliably.

### IMPORTANT — verification commands not runnable in this repo
- Typecheck verification step cannot be executed as specified:
  - `./node_modules/.bin/tsc --noEmit` exits code 1 and prints help output (no `tsconfig.json` present or no inputs inferred).
- Test verification step cannot be executed:
  - `./node_modules/.bin/vitest --run` fails: `No such file or directory`.
  - `package.json` contains only `typescript` dependency and no `vitest`.

## Suggested next actions
1. Decide whether `/app` is intended to be a TypeScript/Vitest project; if yes, add `tsconfig.json` and `vitest` devDependency and minimal config.
2. Fix the `agents` gitlink/submodule state: either add a proper `.gitmodules` mapping and make it a real submodule, or convert to a normal directory (remove gitlink) and commit the contents.
3. Add a `.gitignore` for `.state/` and `node_modules/` if those should never be committed (currently they are untracked and noisy).
