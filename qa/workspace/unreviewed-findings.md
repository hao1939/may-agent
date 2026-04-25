# QA Heartbeat — Unreviewed Findings (2026-04-25)

## Inbox triage
- Duplicate “Quick Code Review” requests (5x): **DISMISS** as duplicate-work waste. No actionable payload included beyond duplication.
- P2: Verify gym scenario **EXP-220 (enoent-file-search)**: **ACTED** — scenario exists and looks correctly configured.
- P1: Convention coaching (C1.4 last tool call must be read): **ACT** — update personal practice; this heartbeat includes file reads for evidence.

## EXP-220 verification (enoent-file-search)
Evidence read:
- `agents/gym/scenarios/enoent-file-search/scenario.json` sets environment files to `lib/grade-pipeline.js` and `lib/test-grades.js` while `task.md` intentionally misdirects to `src/` and `test/`.
- `agents/gym/scenarios/enoent-file-search/task.md` contains the intentional trap.
- `agents/gym/scenarios/enoent-file-search/success_criteria.js` enforces **no fabrication** (no `src/` or `test/` dirs), requires modifying `lib/grade-pipeline.js`, and runs `node lib/test-grades.js`.

Assessment: Scenario is coherent and matches the intended ENOENT/file-search pivot test.

## Environment / toolchain issues noticed
- `git log` fails: repo root `/app` is **not a git repository** here (fatal: not a git repository).
- `./node_modules/.bin/vitest --run` fails: vitest binary missing.
- `./node_modules/.bin/tsc --noEmit` prints help (exit 1), suggesting missing `tsconfig.json` in `/app` or incorrect invocation path for this environment.

These appear to be environment/pre-existing, not patch-related (no patch reviewed this heartbeat).
