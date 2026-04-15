# Tool Gap Analysis — Bash Pattern Mining (Apr 15, Recent 12h)

**Date**: 2026-04-15  
**Session**: Mode B work session  
**Data source**: 85+ session.jsonl files from Apr 8-15 (on-disk), plus DB metadata for Apr 15 sessions  
**Prior work**: Extends [finding-bash-command-patterns-0411.md](finding-bash-command-patterns-0411.md) and [finding-tool-gap-analysis-0415.md](finding-tool-gap-analysis-0415.md)

---

## Executive Summary

Three **new** wasteful bash patterns identified — not previously documented in the Apr 11 analysis. The biggest is the PATH boilerplate problem (up to 57 wasted ops in a single session), which tech-lead is actively addressing. The other two — git commit ceremony and session-existence probing — are smaller but recurrent.

**Estimated fleet-wide savings**: 40-80 ops/day across all agents.

---

## Pattern 1: PATH Boilerplate Repetition (CRITICAL — fix in progress)

### What
Every bash call requiring `bun` starts with `export PATH=".state/.bun/bin:$PATH"`. This prefix is repeated **on every single DB query and bun script invocation** — agents never remember PATH persists across calls.

### Evidence
| Session | Agent | `export PATH=` count | Session total ops |
|---------|-------|---------------------|-------------------|
| s_1776002093322_2160 | (optimizer) | **57** | ~60 |
| s_1776056469810_18 | (coach) | 35 | ~40 |
| s_1776011071613_2237 | (optimizer) | 34 | ~35 |
| s_1776014661800_2260 | (optimizer) | 33 | ~35 |
| s_1776009266093_2221 | (optimizer) | 23 | ~25 |
| s_1776002056765_2158 | (various) | 21 | ~25 |

The top session had **57 out of ~60 bash calls** include the PATH boilerplate — nearly every op was a DB query prefixed with the same `export PATH=...`.

### Ops wasted per occurrence
Not wasted per call (the export is part of the command string), but the **cognitive overhead** causes agents to wrap every bash call in the same template, making commands harder to read and more error-prone. The real cost is indirect: agents avoid `read()` or `edit()` and instead chain bash DB queries because the boilerplate "template" is easy to copy.

### Fix status
**Tech-lead session s_1776240068573_8** (today, 08:01 UTC) already addressed this — "Fix PATH env for bash tool." Status: done. The fix appears to add PATH to the default bash environment so agents don't need the prefix.

### Recommendation
Verify tech-lead's fix actually eliminates the pattern in the next 6h. If agents still prepend `export PATH=`, the fix needs to be at the tool level (inject PATH before every bash command in `src/lib/tools/bash.ts`).

---

## Pattern 2: Git Commit Ceremony (NEW — 5-14 ops per commit)

### What
Agents follow a rigid multi-step git commit pattern:
1. `cd /app/agents && git add <files>` (1 op)
2. `git diff --cached --stat` (1 op — verify what's staged)
3. `git commit -m "..."` (1 op)
4. `git status` (1 op — verify clean)
5. `git log --oneline -3` (1 op — verify commit landed)

Some sessions add more steps: `git log --oneline -200 | grep ...` to search history, `git reflog` to check for issues, `git remote -v` to check remotes. The s_1776003865427_2174 session had a **13-step git archaeology chain** searching for duplicate commits.

### Evidence
| Session | Agent | Git ops | Pattern |
|---------|-------|---------|---------|
| s_1776014661800_2260 | optimizer | 14 | commit + log archaeology |
| s_1776007420621_2197 | (various) | 10 | commit + history search |
| s_1776011067924_2235 | (various) | 9 | commit + verification chain |
| s_1776005707627_2190 | (various) | 9 | commit + verification chain |
| s_1776003865427_2174 | (various) | 5 | duplicate commit search |

**15 sessions** had ≥5 git ops each — conservatively 75+ git ops across these sessions.

### Ops wasted per occurrence
- Basic commit: 5 ops (add, diff, commit, status, log) → could be **1 op** with a script
- History search: 5-10 ops → could be **1 op** with a query script

### Fix proposal: `scripts/agent-commit.sh`
```bash
#!/bin/bash
# Usage: scripts/agent-commit.sh "commit message" [files...]
# Does: git add, commit, verify, and output the result — all in one op
cd /app/agents
git add "${@:2}"
git diff --cached --stat
git commit -m "$1"
git log --oneline -1
git status --short
```
**Expected savings**: 3-4 ops per commit × ~20 commits/day = **60-80 ops/day**.

---

## Pattern 3: Session-Existence Probing (NEW — 3-8 ops per investigation)

### What
When agents need to analyze past sessions, they first **probe whether session files exist on disk** — because older sessions get cleaned up. This creates a multi-step discovery loop:

1. `ls .state/sessions/` → see what's available (1 op)
2. `ls .state/sessions/<sid>/` → check specific session has files (1 op, often repeated for 3-5 sessions)
3. Eventually find one that exists, then proceed to analyze it

The optimizer session s_1776014661800_2260 spent **8 ops** just trying to find sessions that still had jsonl files on disk.

### Evidence
From s_1776014661800_2260 bash commands (in order):
```
ls .state/sessions/s_1775957061724_1754/ ... 2>/dev/null  # 3 sessions, none found
ls .state/sessions/ | head -20  # browse what's there
ls .state/sessions/ | tail -30  # browse more
ls .state/sessions/s_1776011024929_2232/  # try another
ls -la .state/sessions/s_1776002093322_2160/  # finally found one
```

This pattern also appeared in: s_1776056469810_18 (coach checking session directories), and our current session (we had to probe to find sessions with jsonl data).

### Ops wasted per occurrence
3-8 ops of pure filesystem probing, depending on how many sessions have been cleaned up.

### Fix proposal: Add `--on-disk` flag to session-query.ts
```typescript
// In scripts/session-query.ts, add filter:
// --on-disk: Only return sessions that still have session.jsonl on disk
// This eliminates the probe-then-check loop
const hasJsonl = existsSync(`.state/sessions/${row.sessionId}/session.jsonl`);
```

Or simpler: a `scripts/find-sessions-with-data.sh` that combines the DB query with filesystem check:
```bash
#!/bin/bash
# Usage: find-sessions-with-data.sh [--hours 12] [--agent optimizer] [--min-ops 10]
# Returns: sessionId, agent, opCount for sessions that still have jsonl on disk
```
**Expected savings**: 2-6 ops per session archaeology task × ~5 tasks/day = **10-30 ops/day**.

---

## Summary: New Patterns vs. Apr 11 Documented Patterns

| Pattern | Apr 11 documented? | Frequency | Savings potential |
|---------|-------------------|-----------|-------------------|
| PATH boilerplate | ❌ No (was "DB query boilerplate" but not quantified) | 15+ sessions, 20-57 per session | Fix in progress |
| Git commit ceremony | ❌ No | ~20 commits/day, 5 ops each | **60-80 ops/day** |
| Session-existence probing | ❌ No | ~5 archaeology sessions/day | **10-30 ops/day** |
| Grep-then-read chains | ✅ Yes (Apr 11: 26.5% of all bash) | Still active: 6-16 per session | Already documented |
| DB query chains | ✅ Yes (Apr 11: 23.2% of all bash) | Still active: 20-57 per session | PATH fix helps |
| Fleet-status query duplication | ✅ Yes (Apr 11: Finding 1) | Now injected in heartbeat | Partially fixed |

---

## Recommended Priority

1. **Verify PATH fix** landed from tech-lead session (today) — highest impact, already in progress
2. **Build `agent-commit.sh`** — highest new-fix ROI, simple to implement, 60-80 ops/day savings
3. **Add `--on-disk` to session-query.ts** — moderate impact, helps optimizer and coach primarily
