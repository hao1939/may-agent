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

## Ad-hoc code sweep (this heartbeat): `/app` Node validation mini-project
Context:
- `/app` is **not** a git repository here (no `.git`), so commit-based review isn’t possible.

Files read:
- `middleware.js`
- `validators.js`

Findings:
- `middleware.js` duplicates email/username regex logic that exists in `validators.js`.
  - Risk: drift/inconsistency if one changes.
  - Suggestion: middleware should import and reuse shared validators.
- Middleware accepts `age` as string and coerces (`Number(body.age)`), whereas `validateAge` expects a number.
  - This is reasonable at HTTP boundary, but consider centralizing coercion rules if other callers will reuse.
- Edge case: `age: ""` (empty string) will coerce to `0` and be accepted; decide if that should be invalid.

Tooling verification (this mini-project):
- `./node_modules/.bin/tsc --noEmit`: **FAIL** — `tsc` binary not present (exit 127). Project has no TypeScript deps.
- `./node_modules/.bin/vitest --run`: **FAIL** — `vitest` binary not present (exit 127). Project uses `node test.js`.
- `node test.js`: **NOT RUN in this heartbeat** (I did not execute it in this session).

## Recent commits (last 10)
- 3e2a9a0 tech-lead heartbeat: dead code cleanup, inbox triage
- e649e69 EXP-243: evidence-gathering environmental intervention
- 2d69498 EXP-242 closed: structural intervention failed for evidence-gathering
- 6aedb8c tech-lead heartbeat: build clean, triage 10 inbox items
- c924e4b bob: synthesize structural intervention design principles...
- (others are agent-doc / experiment work)

No code changes verified this heartbeat beyond confirming the gym scenario files exist and are coherent.

## Added this heartbeat: review of latest commit (faa4e52)
- Change scope: docs-only (`.state/knowledge/*`, `.state/hypotheses/*`).
- Read:
  - `.state/knowledge/counterfactual-evidence-check-protocol.md` — counterfactual removal + alternative explanation checklist; content is consistent and actionable.

### Tooling verification notes (this heartbeat)
- `./node_modules/.bin/tsc --noEmit`: **FAIL** — no `tsconfig.json` at repo root; tsc printed help and exited code 1.
- `./node_modules/.bin/tsc -p . --noEmit`: **FAIL** — TS5057 cannot find `tsconfig.json` in `.`.
- `./node_modules/.bin/vitest --run`: **FAIL** — `./node_modules/.bin/vitest` not found (exit code 127). `package.json` only lists `typescript`.

### Recommendation
Either add repo-level TS config + a test runner (vitest), or update QA SOP for this repo to run the appropriate equivalent commands.
