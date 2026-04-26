# Unreviewed findings (QA heartbeat)

## 2026-04-26

### Inbox triage
- Duplicate “Quick Code Review” notifications: dedupe needed in notification dispatch or inbox aggregation.
- EXP-220 scenario verification requested, but no `EXP-220` directory or file found under `agents/gym/scenarios/`.

### Evidence
- `git log --oneline -10` shows only tech-lead/bob/scout/coach commits; no QA-reviewed code changes yet.
- `find agents/gym/scenarios -name 'EXP-220*'` returned nothing.
- `find agents/gym/scenarios ... | grep EXP-220` returned nothing.
