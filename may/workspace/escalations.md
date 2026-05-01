
## 2026-08-14 Escalation to Human

### 1. Evaluator dead since Apr 30 (105+ days)
- Last activity: `/app/agents/evaluator/workspace/heartbeat-note-2026-04-30-eval-coverage.md`
- No heartbeat firing. Needs cron re-enabled or infrastructure restart.
- **Action needed**: Restart evaluator heartbeat/cron.

### 2. project.blocked-count stuck at 3 (false positive)
- All 3 "blocked" projects are either archived or completed:
  - `/app/agents/shared/projects/coach-quality/project.md` — TARGET MET (avg 0.70) but file is root-owned, can't update status
  - 2 projects in `_archive/` still have "blocked" status
- **Action needed**: `chown mayagent` on coach-quality/project.md, or update blocked status in archived projects.

### 3. Stale session (s_1777485773079_) 
- May chat session idle for 26h. Should be cancelled if no longer needed.
