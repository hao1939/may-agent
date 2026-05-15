# Finding: May Persistent-Task Session Bloat

**Date**: 2026-04-22  
**Mode**: B — Tool Gap Analysis  
**Scope**: Top 2 may sessions by opCount in last 6h (both from metric-reactivity persistent task)

## Sessions Analyzed

| Session | opCount | Duration | Task |
|---------|---------|----------|------|
| `s_1776683932909_223` | 69 | ~11 min | Iteration 5 — verify metric-alert auto-fork works |
| `s_1776683033421_69` | 60 | ~9 min | Iteration 3 — verify auto-fork, backfill alerts |

## Pattern 1: Exploratory Codebase Archaeology (~25 ops wasted per session)

Both sessions spend massive ops trying to understand the codebase from scratch each iteration:

- **Session 223**: 17× `grep -r`/`grep -rn` + 8× `find` commands exploring the codebase layout, searching for DB paths, finding script locations, locating config files.
- **Session 69**: 15× `grep -rn` + 6× `find` + 6× `sed -n` commands doing the same exploration.

**Root cause**: Persistent-task iterations don't carry forward a "codebase map" or "findings so far" artifact. Each iteration re-discovers the same facts: where the DB lives, which file has the metrics handler, what the fork mechanism looks like.

**Ops wasted**: ~25 per session (50 total across both).

## Pattern 2: DB Access Fumbling (~8 ops wasted per session)

Both sessions struggle to query the state DB:

- **Session 223**: Tries `sqlite3` (not installed), then multiple `node -e` attempts with wrong DB paths, wrong table names, iterating through errors.
- **Session 69**: Tries `sqlite3`, then switches to `bun -e`, multiple attempts with wrong paths/queries.

**Root cause**: No documented DB schema or access pattern available in context. Agent must discover DB location, available tool (`bun` not `sqlite3`), table names, and column names through trial-and-error each time.

**Ops wasted**: ~8 per session (16 total).

## Pattern 3: Git Commit Struggles (~8 ops wasted per session)

Both sessions end with a prolonged git commit sequence:

- **Session 223**: 10 git commands — `git add`, `git diff --cached`, `git status`, `git diff HEAD`, `git ls-files`, `git log`, repeated status checks before finally committing.
- **Session 69**: 5 git commands with similar retry pattern.

**Root cause**: Agent is uncertain about git state (what's tracked, what's staged, what the working dir is) and uses multiple probing commands before committing.

**Ops wasted**: ~8 per session (16 total).

## Pattern 4: Absolute vs Relative Path Confusion (~4 ops wasted, session 69 only)

Session 69 starts by exploring `/home`, then `/home/user/repos/`, before finding the project at `/app/`. Then continues mixing `/app/agents/...` absolute paths throughout.

**Ops wasted**: ~4 (session 69 only).

## Summary

| Pattern | Ops Wasted (per session) | Fixable? |
|---------|--------------------------|----------|
| Codebase re-exploration | ~25 | Yes — context artifact |
| DB access fumbling | ~8 | Yes — tool or snippet |
| Git commit struggles | ~8 | Yes — helper script |
| Path confusion | ~4 | Yes — context note |
| **Total** | **~41 of 60-69** | |

**Efficiency**: Only ~30-40% of ops in these sessions are productive (actual verification, code changes, writing reports).

## Can a Tool/Workflow Fix Help?

**Yes, strongly.** Three interventions:

1. **Persistent-task iteration context**: The persistent-task workflow should attach a `discoveries.md` artifact that accumulates across iterations — DB paths, key file locations, schema info, and prior findings. This alone would eliminate Pattern 1 (~25 ops/session).

2. **DB query helper**: A standard snippet or tool for querying `.state/may.db` with `bun:sqlite` should be included in may's context. Pattern: `bun -e "import{Database}from'bun:sqlite';const db=new Database('.state/may.db',{readonly:true});..."`. Eliminates Pattern 2 (~8 ops/session).

3. **Git commit helper**: A simple `git add -A && git status --short && git commit -m "MSG"` one-liner convention, or a shared script, would replace the 5-10 probing commands. Eliminates Pattern 3 (~8 ops/session).

## Concrete Recommendation

**Priority 1** (highest impact): Add a `## Iteration Context` section to persistent-task prompts that carries forward key discoveries from prior iterations. The persistent-task workflow already tracks milestones — it should also track "established facts" like file paths, DB locations, and access patterns. **Expected savings: 25 ops/session → ~40% efficiency gain.**

**Priority 2**: Add to may's `context.md`:
```
- State DB: .state/may.db (bun:sqlite, NOT sqlite3 CLI)
- Key tables: sessions, evaluations, metrics, metric_alerts, metric_snapshots
- Project root: /app (always use relative paths from here)
- Git commit pattern: cd /app/agents && git add -A && git commit -m "description"
```
**Expected savings: 12 ops/session → ~18% efficiency gain.**

**Combined expected impact**: Reduce these sessions from 60-69 ops to ~25-30 ops (~55% reduction).
