# Heartbeat 2026-05-05 10:12Z

## Red Metrics Status

Both `project.active-count=0` and `project.blocked-over-6h=2` are caused by the git assume-unchanged issue documented in KE-744. Root cause: 21 files (including all project.md files) have `--assume-unchanged` set since 2026-04-29, so project state changes never reach the git index.

**Required fix (human only):** `git update-index --no-assume-unchanged` on affected files.

## System Health
- Session success rate: 100% (45/45 in last hour)
- All 14 cron jobs healthy
- Heartbeat coverage: 8/8 agents
- Error rate: 0.7%
- No stuck sessions or failing agents
