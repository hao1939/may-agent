# Finding: Cron Dead Weight

**Date**: 2026-04-19  
**Lens**: C (Dead Weight)  
**Severity**: Low (no runtime cost, but adds cognitive load and disk clutter)

## Summary

3 handler files on disk have no corresponding cron.json entry (orphans). 2 cron entries are explicitly marked DEPRECATED and disabled. 1 entry is disabled for environment reasons. All enabled entries have existing handlers and produce observable effects.

## Orphan Handler Files (no cron entry)

These `.ts` files exist in `agents/may/handlers/` but are never referenced by any `"handler"` field in `agents/may/cron.json`:

1. **`agents/may/handlers/common-sense-audit.ts`** (244 lines) — No cron entry. Likely superseded by the `common-sense-verify` cron entry which uses `run-agent-task` handler instead.
2. **`agents/may/handlers/priority-drift.ts`** (401 lines) — No cron entry. Never invoked.
3. **`agents/may/handlers/project-resume.ts`** (410 lines) — No cron entry. Never invoked.

**Total dead code: ~1,055 lines** across 3 files.

## Deprecated/Disabled Cron Entries

These entries in `agents/may/cron.json` are disabled and self-document as deprecated:

1. **`error-log-scanner`** (`agents/may/cron.json` line ~200, `enabled: false`) — Description says "DEPRECATED: Replaced by error-scan sensor-judge workflow." Handler file `agents/may/handlers/error-log-scanner.ts` (384 lines) still exists as rollback.
2. **`coaching-feedback`** (`agents/may/cron.json` line ~260, `enabled: false`) — Description says "DEPRECATED — migrated to coaching-feedback-wf sensor-judge workflow." Handler file `agents/may/handlers/coaching-feedback.ts` (161 lines) still exists as rollback.
3. **`heartbeat-amy-kimi`** (`agents/may/cron.json`, `enabled: false`) — Description says "Disabled locally to avoid duplicate work." Not deprecated, just environment-specific. Not dead weight.

## Enabled Entries: All Active

All 37 enabled cron entries have valid handlers (either built-in `heartbeat` type, or matching `.ts` file in `handlers/`). DB query confirmed 13 cron-sourced sessions in the last 24h (`sessions` table, `source='cron'`), plus ~599 null-source sessions (heartbeats lack source tagging but are clearly cron-driven).

## Recommended Actions (do NOT implement now)

1. **Delete orphan files**: Remove `common-sense-audit.ts`, `priority-drift.ts`, `project-resume.ts` — 1,055 lines of unreachable code.
2. **Delete deprecated entries + handlers**: Remove `error-log-scanner` and `coaching-feedback` cron entries and their handler files (545 lines) once rollback window has passed.
3. **No action needed** for `heartbeat-amy-kimi` — valid environment toggle.
