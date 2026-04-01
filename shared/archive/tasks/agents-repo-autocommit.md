# Task: Auto-commit agents/ sub-repo changes

**Priority:** P1 — data loss risk
**Requested by:** Hao (via may)
**Assigned to:** tech-lead

## Problem

The `agents/` directory is a separate git repo (has its own `.git/`) and is gitignored by the parent `may-agent` repo. When agents or humans edit files in `agents/` (TOOLS.md, LESSONS.md, SOUL.md, heartbeat.md, agent.json, etc.), those changes sit as uncommitted modifications indefinitely.

**Current state (2026-03-17):**
- 88 uncommitted changes (82 modified files, 6 untracked)
- No remote configured — local-only repo
- Last commit: `ee27553` at 2026-03-17 20:49 (manual commit by scout)
- Git user: `Scout Agent <scout@agents.local>`
- No git hooks active (all `.sample`)
- No system crontab
- No existing automation for this

**Risks:**
- Agent config improvements lost on any reset/redeploy
- No history of what changed and when
- No way to revert a bad change
- 747 lines of insertions across the current uncommitted diff

## Investigation Summary

```
Repo location: /home/hao/may-agent/agents/
Parent .gitignore: includes "agents/" — so parent repo ignores this entirely
Remote: none configured
Hooks: all sample (none active)
System crontab: empty
```

## Recommended Approach: May's cron-based auto-commit

The simplest, most reliable approach is a **cron job on May's agent** that periodically:
1. Checks for uncommitted changes in `/home/hao/may-agent/agents/`
2. If changes exist, stages all and commits with an auto-generated message
3. Runs every 10-15 minutes

### Why cron on May (not a git hook or session hook):
- **Git hooks** only fire on manual git operations — agents don't run `git commit`, so hooks won't trigger
- **Session lifecycle hooks** would miss changes made by humans or by agents that crash
- **May's cron** runs independently regardless of who made changes, and May is always running

### Implementation sketch

```bash
#!/bin/bash
# auto-commit-agents.sh
cd /home/hao/may-agent/agents || exit 1

# Check for changes (tracked + untracked)
if [ -n "$(git status --porcelain)" ]; then
  git add -A
  CHANGED=$(git diff --cached --stat | tail -1)
  git commit -m "auto: ${CHANGED}"
fi
```

Then register as a May cron job (~10min interval).

### Git config to set:
```
git config user.name "may-agent"
git config user.email "may@agents.local"
```

## Deliverables

1. Create the auto-commit script at `/home/hao/may-agent/scripts/auto-commit-agents.sh`
2. Register it as a May cron job (10-minute interval)
3. Fix the git user config (currently "Scout Agent" — should be "may-agent")
4. Do an initial commit of all 88 pending changes right now
5. Test the cron job fires and commits correctly

## Open questions for Hao
- Should we set up a remote (GitHub) for the agents repo for off-machine backup?
- Any files in agents/ that should be .gitignored (e.g., ERROR_LOG.jsonl)?
