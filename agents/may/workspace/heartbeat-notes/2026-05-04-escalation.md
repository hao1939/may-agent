# Escalation: Red Metrics (project.active-count, project.blocked-over-6h)

**Date:** 2026-05-04
**Root Cause:** KE-744 — 21 files have `git update-index --assume-unchanged` set in agents/ repo.

## Action Needed (Human)

```bash
cd agents
git ls-files -v | grep '^h ' | awk '{print $2}' | xargs git update-index --no-assume-unchanged
git status  # review diffs
git add -A && git commit -m "fix: clear assume-unchanged bits on 21 tracked files (KE-744)"
```

This will resolve both red metrics by allowing project status changes to propagate through git.
