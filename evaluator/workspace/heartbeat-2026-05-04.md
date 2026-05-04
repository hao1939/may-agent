# Evaluator heartbeat — 2026-05-04

## Signals checked

### DB recency
- `evaluations.max(createdAt)` is recent: **1777878757717** (see bash output in session transcript)
- `sessions.max(startedAt)` is more recent: **1777888204403**

### Coverage (pipeline health proxy)
Computed from DB:
- All time: `evaluations=2595` / `sessions(status='done')=11688` → **22.2%**
- Last 24h: `done sessions=1729`, `evaluations created=100` → **5.78%**
- Last 6h: `done sessions=369`, `evaluations created=7` → **1.90%**

### Legacy artifacts
- `.state/evaluations/*.json` newest mtime: **Apr 29** while DB has evaluations as recent as **May 4** → indicates **output-path drift** (DB is canonical; legacy folder stale).

## Interpretation
- Evaluation is not fully down (DB is getting new rows), but **coverage is extremely low in the last 6–24h**, consistent with **intermittent/partial execution** of the `evaluation-sync` handler.
- Prior May audit suggests a known failure mode: cron hot-reload / handler registration gaps can stop `evaluation-sync` from being invoked.

## Action taken
- Create an escalation note for May/tech-lead: quantify the current coverage drop and point to the likely failure mode (evaluation-sync not keeping up / not running).
