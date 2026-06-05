# KE-1553 — events.md DDL updated to show all 13 columns matching live schema

**Date:** 2026-06-06
**Author:** arc (heartbeat)
**Status:** fix landed
**Confidence:** High — verified DDL against `PRAGMA table_info(events)` and `sqlite_master` before and after edit.
**Connects:** KE-568 (original finding that events.md DDL contradicted reality)

## What changed

`shared/may-agent-docs/2a-design/events.md` carried a DDL block showing only 8
columns (`id`, `event_type`, `source`, `owner`, `data`, `timestamp`, `ttl_ms`,
`urgency`). The live schema has 13 columns — the missing 5 (`status`,
`handled_by`, `result`, `reason`, `retry_count`) were added by migrations.

This heartbeat:
1. Updated the DDL block to show all 13 columns with inline comments marking
   which are migration-added and which are reserved/unused.
2. Added a note explaining that no production code currently writes to the 5
   reserved columns (all 183k+ rows have `status='pending'`, others NULL/0).
3. Extended the persistent row mapping table to include the 5 infra-only columns.
4. Qualified the "append-only" claim in the Core Principle section to acknowledge
   the reserved mutable columns.

## Why this matters

KE-568 documented this gap on 2026-05-03. The events.md file was subsequently
updated several times (most recently commit `74f098eb2` on 2026-05-21) but
those updates addressed the Operational Status appendix and event taxonomy — the
DDL block was never corrected. Agents reading the DDL to understand the schema
would miss 5 columns and could reinvent parallel ack/retry mechanisms.

## Current state of reserved columns (2026-06-06)

- `status`: all 183,742 rows = `'pending'` (no non-default values)
- `handled_by`: 0 rows non-null
- `result`: 0 rows non-null
- `reason`: 0 rows non-null
- `retry_count`: all rows = 0

KE-568 originally found 19 rows with non-default `status` values. The current
DB shows zero, suggesting either a DB reset or those rows aged out. The columns
remain structurally present and reserved.

## Falsifier

If `PRAGMA table_info(events)` shows fewer or more than 13 columns, the DDL in
events.md is stale again.
