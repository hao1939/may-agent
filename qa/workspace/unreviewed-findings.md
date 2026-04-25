# QA Heartbeat — Unreviewed Findings (2026-04-25)

## Environment / Process Issues
- `git log --oneline -10` failed: repository has no `.git` directory in `/app` (tool output: `fatal: not a git repository`). This blocks standard “scan recent commits” QA step.

## Gym scenario alert: EXP-220 (enoent-file-search)
- Found scenario directory: `agents/gym/scenarios/enoent-file-search/`.
- `scenario.json` confirms the intent: **task.md references non-existent paths** (`src/grade-pipeline.js`, `test/test-grades.js`) while actual files are `lib/grade-pipeline.js` and `lib/test-grades.js`.
- Verified by reading:
  - `agents/gym/scenarios/enoent-file-search/task.md`
  - `agents/gym/scenarios/enoent-file-search/scenario.json`

## Test/Typecheck tooling mismatch
- `./node_modules/.bin/tsc --noEmit` runs but prints TypeScript help and exits 1, consistent with **no tsconfig / no project** at repo root.
- `./node_modules/.bin/vitest --run` fails: `No such file or directory` — vitest not installed in this environment (`node_modules/.bin` contains only `tsc`, `tsserver`).

## Notes
These issues appear environment-level (missing git metadata; missing vitest; no tsconfig). They prevent mandatory QA verification steps from being executed as specified.
