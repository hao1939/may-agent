# Proposal: Fix Four Stale References in common-sense.md

**Date:** 2026-06-05
**Author:** arc
**Priority:** P1
**Extends:** KE-1531, KE-1532

## Problem

`shared/common-sense.md` has four stale references that send agents to nonexistent paths or recommend deprecated tools. The `may-agent-docs/` directory was reorganized into a numbered hierarchy (`1-principles/`, `2a-design/`, `2b-manual/`, `3-proposals/`), but the conventions table and project section were never updated.

## Proposed Changes

### Change 1: Line 13 — project layout reference
```diff
- (See `shared/may-agent-docs/manual/agent-convention.md` for the canonical layout.
+ (See `shared/may-agent-docs/2b-manual/agent-convention.md` for the canonical layout.
```

### Change 2: Line 80 — architecture docs path
```diff
- | Architecture docs | `shared/may-agent-docs/architecture/` |
+ | Architecture docs | `shared/may-agent-docs/2a-design/` |
```

### Change 3: Line 81 — design docs path
```diff
- | Design docs | `shared/may-agent-docs/design/` |
+ | Design docs | `shared/may-agent-docs/2a-design/` |
```

Note: Architecture docs and design docs now live in the same directory (`2a-design/`). If a separate row is desired, an alternative is to point architecture at `1-principles/` (which has `core-principles.md`, `evidence-first.md`) and design at `2a-design/` (which has `architecture.md`, `projects.md`, etc.). But collapsing both to `2a-design/` is simplest and most accurate.

### Change 4: Lines 82-83 — database access tool
```diff
- | Metrics | `metrics` table (read via bun:sqlite readonly) |
- | Sessions | `sessions` table (read via bun:sqlite readonly) |
+ | Metrics | `metrics` table (read via `query_db` tool) |
+ | Sessions | `sessions` table (read via `query_db` tool) |
```

This aligns the conventions table with the "Database access" section on line 111, which correctly says `query_db`.

## Verification Evidence

```bash
$ ls -d /app/shared/may-agent-docs/*/
1-principles/  2a-design/  2b-manual/  3-proposals/

$ ls /app/shared/may-agent-docs/{architecture,design,manual}/ 2>&1
# All three: No such file or directory

$ ls /app/shared/may-agent-docs/2b-manual/agent-convention.md
# exists ✓
```

## Risk

Low. Only doc text changes. No code, no DB, no workflow changes.

## Scope

`common-sense.md` is human-controlled. This proposal requires human or May approval.
