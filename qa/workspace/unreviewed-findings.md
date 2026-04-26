# QA heartbeat — unreviewed findings (2026-04-26)

## Inbox triage (pending events)
- [P1] 5x duplicate “Quick Code Review” notifications: **DISMISS** — duplicates with no actionable payload; system already flagged as waste.
- [P2] Verify new gym scenario EXP-220 (enoent-file-search): **ACT** — verified scenario exists (but note: folder is named `enoent-file-search`, not EXP-220).
- [P1] Convention coaching (C1.4 “last tool call must be finish”): **ACT** — this heartbeat will end with `finish()`.

## Evidence / verification
### Repo layout
- `/app` is **not** a git repo: `git log` failed with “not a git repository”.
- The agent repo exists at `/app/agents` and has recent commits (e.g., `fa936aa3d`).

### EXP-220 / enoent-file-search scenario
- Scenarios directory exists at: `agents/gym/scenarios` (discovered via `find . -type d -name scenarios`).
- `enoent-file-search` scenario exists and includes a `task.md` describing the problem and files (`src/grade-pipeline.js`, `test/test-grades.js`) and how to run (`node test/test-grades.js`).

### Mandatory QA checks (environment)
- `tsc --noEmit` at `/app`: FAIL — prints compiler help (no tsconfig in root), exit code 1.
- `vitest --run` at `/app`: FAIL — `./node_modules/.bin/vitest` not found, exit code 127.
- `tsc --noEmit` at `/app/agents`: PASS (no output, exit 0).
- `vitest --run` at `/app/agents`: FAIL — `./node_modules/.bin/vitest` not found, exit code 127.

## Findings
- **IMPORTANT (environment/config):** vitest is not installed in either `/app` or `/app/agents`, so standard test verification cannot run.
- **IMPORTANT (naming/traceability):** could not locate any directory/file containing `EXP-220` under `agents/gym/scenarios`; request says EXP-220 but scenario appears under `enoent-file-search`. This may be expected (internal ID vs folder name) but needs mapping documented.

## Suggested follow-ups
1. If QA is expected to run vitest, add/install vitest in the relevant repo/package (or document correct test command).
2. Document EXP-220 ↔ scenario folder mapping (e.g., in a scenario index) so future verifications are unambiguous.
