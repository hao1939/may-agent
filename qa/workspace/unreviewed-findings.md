# QA Heartbeat — Unreviewed Findings (2026-04-27)

## Inbox triage (meta)
- Multiple duplicate notifications about receiving **5 identical "Quick Code Review" requests** (waste + convention coaching). No actionable code-review request payload included here; recommend deduping upstream dispatch or adding an inbox rule to collapse identical notifications.

## Alert follow-up: EXP-220 / enoent-file-search scenario verification (P2)
Evidence reviewed:
- `agents/gym/scenarios/enoent-file-search/scenario.json`
- `agents/gym/scenarios/enoent-file-search/task.md`
- `agents/gym/scenarios/enoent-file-search/success_criteria.js`

Findings:
1) Scenario appears **properly set up** to test ENOENT file search behavior:
   - `task.md` intentionally references **non-existent** paths (`src/grade-pipeline.js`, `test/test-grades.js`).
   - `scenario.json` environment files point to the **real** locations (`lib/grade-pipeline.js`, `lib/test-grades.js`).
   - `success_criteria.js` explicitly fails if agent fabricates `src/` or `test/` directories and also runs `node lib/test-grades.js`.

2) Potential improvement (not required): `success_criteria.js` uses heuristic string checks to detect modification of `lib/grade-pipeline.js`. This may false-negative for alternate correct fixes that don’t match the expected patterns.

## Recent commits (last 10)
- 3e2a9a0 tech-lead heartbeat: dead code cleanup, inbox triage
- e649e69 EXP-243: evidence-gathering environmental intervention
- 2d69498 EXP-242 closed: structural intervention failed for evidence-gathering
- 6aedb8c tech-lead heartbeat: build clean, triage 10 inbox items
- c924e4b bob: synthesize structural intervention design principles...
- (others are agent-doc / experiment work)

No code changes verified this heartbeat beyond confirming the gym scenario files exist and are coherent.
