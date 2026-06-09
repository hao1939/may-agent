# KE-1773: Sessions Schema Missing lastActivityAt Column in Design Docs

**Status**: resolved
**Discovered**: 2026-06-10
**Scope**: documentation / design doc accuracy
**Related**: KE-1558, KE-816

## Claim

The `sessions.md` design doc (`shared/may-agent-docs/2a-design/sessions.md`)
documented the sessions table schema but omitted the `lastActivityAt INTEGER`
column, which was added via migration in `src/lib/db/schema.ts` and is actively
written by the runtime (manager.ts sets it to `Date.now()` on session creation
and tool-call activity).

This column is used by the zombie-session detector
(`capability.zombie-session-count` metric) and by project-execution-engine
watchdog workflows. Any agent consulting sessions.md for schema reference would
not know it exists.

## Evidence

- `PRAGMA table_info(sessions)` returns 17 columns; sessions.md documented 16.
- `schema.ts` line 321-323: `ALTER TABLE sessions ADD COLUMN lastActivityAt INTEGER` + index creation.
- `manager.ts` lines 525, 1349, 1404: `lastActivityAt: Date.now()`.
- `sessions.ts` lines 46-50, 97-101, 131-134: COALESCE-style UPDATE logic.
- In-production query: 2/736 sessions in last 24h have non-null `lastActivityAt`
  (the column was migrated recently; older sessions have NULL).

## Fix

Added `lastActivityAt INTEGER` to the effective schema in sessions.md
with a comment explaining its purpose (zombie-session detection, added via
migration).

## Lesson

Migration-added columns are easy to miss in design docs. When auditing schema
docs, always run `PRAGMA table_info()` and diff against the documented DDL.
