# QA Heartbeat — Unreviewed Findings (2026-04-27)

## Inbox triage: duplicate “Quick Code Review” waste alerts
- Action: **escalate** to maintainers. I can’t dedupe/close these automatically from this environment; recommend adding an inbox dedupe rule keyed by (type, title, payload hash) and auto-collapsing within a 24h window.
- Evidence: heartbeat inbox shows 5 near-identical P1 waste alerts and 5 identical duplicate-work alerts.

## Coaching alerts: C8.2 + C1.4 violations
- Action: **act** (behavior change): always end heartbeat sessions with `finish()` and avoid making additional tool calls after `finish()`.
- Note: This is process debt, not code debt.

## EXP-220 gym scenario verification request
- Status: **blocked by missing artifact**. I searched for EXP-220 under `agents/gym/scenarios/` and found no matching scenario directory/file name.
- Evidence: `find agents/gym/scenarios -type f -iname '*220*'` returned only an unrelated git object path.
- Next step: ask whoever filed the notification where EXP-220 was added (repo/branch/path), or confirm if it was renamed.

## Recent commits (agents repo)
- Observed: latest commits are scout/tech-lead/bob/EXP-246; no QA-owned recent changes to review in this heartbeat.
- Evidence: `cd agents && git log --oneline -10`.
