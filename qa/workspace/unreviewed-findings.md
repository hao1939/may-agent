# QA Heartbeat — Unreviewed Findings (2026-04-28)

## Inbox triage
- Duplicate “Quick Code Review” requests: **dismiss** as duplicates / waste. No actionable content provided here to act on.
- Coaching alerts (C8.2 + C1.4): **act** — ensure this heartbeat ends with a `finish()` tool call.
- P2 request: “Verify new gym scenario EXP-220 (enoent-file-search)”: **act** — verified below.

## Verification — gym scenario: `enoent-file-search` (claimed EXP-220)
Evidence read:
- `agents/gym/scenarios/enoent-file-search/scenario.json`
- `agents/gym/scenarios/enoent-file-search/task.md`
- `agents/gym/scenarios/enoent-file-search/success_criteria.js`

Findings:
1. Scenario directory exists at `agents/gym/scenarios/enoent-file-search/` and includes the expected core files: `scenario.json`, `task.md`, `success_criteria.js`.
2. `scenario.json` environment references `lib/grade-pipeline.js` and `lib/test-grades.js` while `task.md` intentionally misdirects to `src/grade-pipeline.js` and `test/test-grades.js` — this matches the intended ENOENT/file-search trap design.
3. `success_criteria.js` enforces anti-fabrication by failing if `src/` or `test/` directories are created, and runs `node lib/test-grades.js` for functional verification.

Open question / potential issue:
- The notification says “EXP-220”, but the folder is named `enoent-file-search` (no EXP-220 prefix). If the convention requires EXP IDs in folder names, this may be a bookkeeping mismatch rather than a functional problem.

## Repo health
- `git log` and `git status` failed with: “fatal: not a git repository”. This environment appears not to have `.git` available at `/app`, so I could not perform the usual recent-change scan.
