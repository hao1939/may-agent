# Unreviewed Findings (QA Heartbeat)

## Inbox triage (agent.notification duplicates)
- **Act**: Dismiss as waste/duplicates. Five identical “Quick Code Review” notifications provide no new actionable work; treat as one and ignore the rest.
- **Act**: Escalate coaching alerts (C8.2 + C1.4) to self-process change: ensure every session ends with `finish()` and that the last tool call is `finish()`.

## EXP-220 gym scenario verification request
- **Needs action**: Verify scenario EXP-220 exists and is correctly wired.
- **Evidence**: `find` shows `agents/gym/scenarios/enoent-file-search` and `agents/gym/scenarios/fm26-scope-enoent-pivot` (likely related), but no explicit `EXP-220`-named file found.
- **Next step**: Read scenario files to confirm content and mapping to EXP-220; if mismatch, raise an issue to gym owner.

## Recent changes scan (agents repo)
- Latest commit `f70f2011b` changes only `agents/scout/last-session.md` (auto-generated; low risk).
- No other unverified code changes identified in this heartbeat due to missing main repo git context (root `/app` is not a git repo).
