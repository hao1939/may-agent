<ai_context>
The common-sense.md conventions table has three stale path references and one stale tool reference. Two doc paths point to nonexistent directories (architecture/ and design/ under may-agent-docs), a line 13 reference points to manual/ instead of 2b-manual/, and the conventions table says "bun:sqlite readonly" while the Database Access section says "query_db".
Triggers: common-sense, stale path, conventions table, may-agent-docs, bun:sqlite, query_db, architecture docs, design docs
</ai_context>

# KE-1532: common-sense.md Conventions Table Has Three Stale Paths and One Stale Tool Reference

**Date:** 2026-06-05
**Author:** arc (heartbeat coherence audit)
**Extends:** KE-1531 (design docs path stale)

## Finding

KE-1531 caught that `shared/may-agent-docs/design/` is stale. A full audit of the conventions table reveals **four** staleness issues, not one:

### 1. Architecture docs path (line 80)
```
| Architecture docs | `shared/may-agent-docs/architecture/` |
```
Directory does not exist. Correct path: `shared/may-agent-docs/1-principles/` (for principles) or `shared/may-agent-docs/2a-design/` (for architecture design docs like `architecture.md`).

### 2. Design docs path (line 81) — already in KE-1531
```
| Design docs | `shared/may-agent-docs/design/` |
```
Directory does not exist. Correct path: `shared/may-agent-docs/2a-design/`.

### 3. Project layout reference (line 13)
```
See `shared/may-agent-docs/manual/agent-convention.md`
```
Path does not exist. Correct path: `shared/may-agent-docs/2b-manual/agent-convention.md`.

### 4. Database tool reference (lines 82-83)
```
| Metrics | `metrics` table (read via bun:sqlite readonly) |
| Sessions | `sessions` table (read via bun:sqlite readonly) |
```
The "Database access" section (line 111) correctly says `query_db`. The conventions table still says `bun:sqlite readonly`, creating a contradiction within the same document.

## The Actual Directory Structure

```
shared/may-agent-docs/
  1-principles/    → core-principles.md, evidence-first.md, etc.
  2a-design/       → architecture.md, projects.md, metrics.md, etc.
  2b-manual/       → agent-convention.md, sdk-quickstart.md, etc.
  3-proposals/     → v2-spec.md, stigmergic-coordination.md, etc.
```

## Impact

Lines 80, 81, and 13 send agents to nonexistent paths. Lines 82-83 suggest a deprecated access method. Agents typically recover via `ls`/`find` but this is friction and occasionally causes session errors. Four agents referenced these paths in the last 7 days (found via grep of transcripts in KE-1531).

## Recommended Fix

All four changes are in `common-sense.md`, which is human-controlled. Proposal filed at `agents/arc/workspace/proposals/2026-06-05-common-sense-stale-paths-fix.md`.

## Verification

```bash
$ ls -d /app/shared/may-agent-docs/*/
# 1-principles/  2a-design/  2b-manual/  3-proposals/

$ ls /app/shared/may-agent-docs/architecture/ 2>&1
# No such file or directory

$ ls /app/shared/may-agent-docs/design/ 2>&1
# No such file or directory

$ ls /app/shared/may-agent-docs/manual/ 2>&1
# No such file or directory

$ ls /app/shared/may-agent-docs/2b-manual/agent-convention.md
# exists ✓
```
