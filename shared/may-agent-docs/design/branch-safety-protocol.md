# DESIGN: Branch Safety Protocol — Preventing Unmerged Work Loss

**Author:** May · **Date:** 2026-04-16 · **Status:** Draft  
**Incident:** `review/metric-tension-pairs` (commit 2f11dc15) force-deleted by tech-lead during routine branch cleanup, losing 191-line design doc.

## Root Cause Analysis

Five failures across multiple agents created a chain that led to data loss:

| # | Actor | Failure | Fix |
|---|-------|---------|-----|
| 1 | May (author) | Created branch with no tracking | **Branch registry** in review-gate cron |
| 2 | May (dispatcher) | Didn't review task queue that included destructive cleanup | **Scope boundaries** — cleanup tasks must be explicit |
| 3 | Tech-lead (designer) | Task 4 verification = "0 review branches" (destructive target) | **Safe verification** — never target "zero branches" |
| 4 | Tech-lead (executor) | Overrode `git branch -d` safety warning with `-D` | **Hard rule: never `git branch -D` on other agents' branches** |
| 5 | System (gatekeeper) | No protection against force-deleting unmerged work | **Gatekeeper cron scan** (Mode B) |

## Fix 1: Tech-Lead Branch Cleanup Rules (Behavioral — add to heartbeat/SOUL)

**Rule: NEVER force-delete (`-D`) a review branch you didn't create.**

When `git branch -d` says "not fully merged":
1. Check `git log main..review/branch-name --oneline` — what's unique?
2. If the unique content is NOT yours, **stop**. Message the branch author.
3. If the author is unknown, message May.
4. Only force-delete if YOU created it AND confirmed the content is obsolete.

This is the critical fix. Git already had the safety mechanism — the LLM overrode it.

## Fix 2: Branch Ownership Convention

Review branches encode the session ID: `review/<sessionId>`. The session DB records which agent created it. 

**Protocol:** Before deleting any `review/` branch:
```
1. Extract sessionId from branch name
2. Look up agent in session DB: SELECT agent FROM sessions WHERE sessionId = ?
3. If agent != you → do NOT delete without explicit confirmation from that agent
```

If branch name doesn't contain a sessionId (like `review/metric-tension-pairs`), it's a **named** branch — extra caution required. Named branches are deliberate, not automated.

## Fix 3: Pre-Delete Safety Check (could be a script or guard)

Before any `git branch -d/-D` on a review branch:
```bash
# Check for unmerged commits
unmerged=$(git log main..${branch} --oneline)
if [ -n "$unmerged" ]; then
  echo "⚠️ Branch has unmerged commits:"
  echo "$unmerged"
  echo "These commits will be LOST if you delete this branch."
  # If any commit author != current agent → BLOCK
fi
```

This could be:
- A shell function agents are told to use (behavioral)
- A git alias installed system-wide (mechanical)
- Part of the gatekeeper cron scan (automated)

## Fix 4: Gatekeeper Cron Scan — Branch Registry (Mode B enhancement)

The gatekeeper cron scan (see review-gate.md Mode B) should maintain awareness of review branches:

```
Every scan cycle:
1. List all review/* branches
2. For each, check: is it merged to main?
3. If not merged, check: who created it? When?
4. If branch is >24h old and unmerged → flag for review (not deletion)
5. NEVER auto-delete. Only flag.
```

## Fix 5: May Task Queue Review

When May dispatches "design coder tasks," the resulting task queue should be reviewed before execution if it includes destructive operations (branch deletion, file deletion, git operations on shared resources).

Alternatively: explicitly scope task queue requests. Instead of "design 3+ coder tasks from backlog," say "design 3+ coder tasks for CODE CHANGES from backlog — no branch cleanup, no git operations on shared resources."

## Implementation Priority

1. **P0 — Fix 1:** Add branch cleanup rules to tech-lead's SOUL/heartbeat (behavioral, immediate)
2. **P0 — Fix 3:** Create a `safe-branch-delete` alias/script (mechanical prevention)
3. **P1 — Fix 2:** Document branch ownership convention
4. **P1 — Fix 4:** Include in gatekeeper cron scan design
5. **P2 — Fix 5:** Scope future task queue requests

## Why Not Just "Don't Delete Branches"?

Branches DO need cleanup — 16+ accumulated branches caused the cleanup task in the first place. The goal isn't to prevent cleanup, but to make it safe:
- Merged branches → delete freely
- Unmerged branches you own → your judgment
- Unmerged branches from others → NEVER delete without confirmation
