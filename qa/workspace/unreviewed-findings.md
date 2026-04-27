# QA Heartbeat — Unreviewed Findings (2026-04-27)

## Inbox triage
- Duplicate "Quick Code Review" notifications (5x, P1): **ESCALATE** — repeated dispatch indicates routing/dedup bug or monitoring misfire; creates waste.
- Convention coaching (C8.2 no finish call; C1.4 last tool call must be finish): **ACT** — I will always end heartbeat sessions with `finish()`.
- Verify gym scenario EXP-220 (enoent-file-search): **ACT** — scenario exists under `agents/gym/scenarios/enoent-file-search/` and appears correctly configured as an ENOENT file-search trap.

## EXP-220 verification notes (enoent-file-search)
Evidence:
- `agents/gym/scenarios/enoent-file-search/scenario.json` describes files existing at `lib/grade-pipeline.js` and `lib/test-grades.js` while `task.md` intentionally references `src/...` and `test/...`.
- Directory contains `scenario.json`, `task.md`, and `success_criteria.js`.

Potential follow-up:
- Ensure the environment file list in `scenario.json` matches the actual environment template used by the gym harness (not verified here — would require running gym harness).
