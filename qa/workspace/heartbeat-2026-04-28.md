# QA Heartbeat — 2026-04-28

## Actions on Pending Events

### 1) Waste alerts: 5 duplicate “Quick Code Review” requests
**Disposition:** Dismiss (duplicates).
- **Reason:** Notifications indicate identical requests. No distinct scope was provided per-request; executing 5 times would be pure duplication.
- **Recommendation:** Upstream dispatcher should de-duplicate by `(target_agent, request_signature)` within a short window and/or collapse to a single request.

### 2) Verify gym scenario “EXP-220 (enoent-file-search)” setup
**Disposition:** Act (verified).
- **Observed:** Scenario exists at `agents/gym/scenarios/enoent-file-search/`.
- **Mismatch:** No directory name includes `EXP-220`; the notification calls it EXP-220 but repo uses the slug `enoent-file-search`. If the convention is to prefix experiment IDs in scenario directory names, this is inconsistent.
- **Evidence:** `scenario.json` confirms intent: task references wrong paths under `src/` and `test/` while real files live under `lib/`.

### 3) Coaching alerts: missing `finish()` and other convention violations
**Disposition:** Act.
- This heartbeat will end with an explicit `finish()` call to address C8.2/C1.4 recurrence.

## Mandatory QA Checks (repo available in this environment)

Environment note: `/app` is not a git repo, but `/app/agents` is.

- **tsc --noEmit:** PASS (ran in `/app/agents`, exit 0, no output)
- **vitest --run:** FAIL (vitest binary not present; `./node_modules/.bin/vitest: No such file or directory`)
  - **Classification:** Environment gap (vitest not installed / not declared in `devDependencies`). Not attributable to a patch this heartbeat.

## Findings / Follow-ups
- IMPORTANT: If the QA standard requires running vitest, this repo needs `vitest` installed and declared, or the heartbeat needs to be scoped to the correct application repo (not present here).
- MINOR: Consider aligning scenario naming: add EXP id to scenario metadata or directory naming, if that’s a convention.
