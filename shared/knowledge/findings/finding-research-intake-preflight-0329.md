# Finding: research-intake needs preflight (2026-03-29)

## Problem
Coach's `research-intake` cron (daily) spawns an LLM session (~13 ops) to check for new files in scout/amy-kimi workspaces. Most of the time there are no new files — scout workspace last had non-heartbeat content from Mar 27, amy-kimi from Mar 24. The session is wasted.

232 historical research-intake sessions exist — a significant proportion found nothing new.

## Fix Applied
Added `new-entries-since` preflight check to the research-intake entry in `cron.json`:
```json
"preflight": {
  "type": "new-entries-since",
  "path": "agents/scout/workspace",
  "stateKey": "research-intake-scout"
}
```

This uses the existing directory file-count tracking mechanism (same as `common-sense-verify` uses for `.state/sessions/history`). If scout's workspace hasn't gained new files since the last successful research-intake run, the coach LLM session is skipped entirely.

## Savings
- ~13 ops/day when scout hasn't produced new content
- Blocked on process restart (PID 52 still running stale binary)

## Commit
eb66b50e (agents repo)
