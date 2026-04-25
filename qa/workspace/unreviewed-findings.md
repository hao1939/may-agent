# QA Heartbeat — Unreviewed Findings (2026-04-25)

## Inbox triage (dedupe / convention)
- Multiple notifications indicate **5 identical “Quick Code Review” requests** were dispatched.
  - Action: **Escalate** to May/Hao: request dedupe at dispatcher level and/or per-agent inbox de-duplication. These appear to be pure coordination waste.

## Gym scenario verification — EXP-220 / enoent-file-search
- Verified scenario exists at `agents/gym/scenarios/enoent-file-search/`.
- Scenario description explicitly tests ENOENT navigation (task.md references wrong paths; real files are under `lib/`).
- Files present:
  - `scenario.json`
  - `task.md`
  - `success_criteria.js`
- Notes:
  - No README.md (attempting to read it produced ENOENT). This is not necessarily a problem if README is optional.
  - `scenario.json` is consistent with the intent: environment files are `lib/grade-pipeline.js`, `lib/test-grades.js`.

## Repo state
- `/app` is not a git repo. `agents/` is a git repo; recent commits are visible there.
