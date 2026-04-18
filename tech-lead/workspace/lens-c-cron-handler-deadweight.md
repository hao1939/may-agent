# Lens C — Cron / Handler Dead-Weight Inventory

**Date:** 2026-04-18 08:01 UTC
**Session:** s_1776499290543_1003
**Scope (3 files):**
1. `agents/may/cron.json` (46 entries enumerated)
2. `agents/may/handlers/` directory (34 `.ts` files enumerated)
3. Representative silent handler: `agents/may/handlers/priority-drift.ts` (orphan)

## Objective
Find (a) cron entries whose handler file is missing, (b) handler files not referenced in cron.json (orphans), (c) entries scheduled but producing zero effect in last 7 days.

## Method
- Enumerated all 46 cron entries in `agents/may/cron.json:1-476`.
- Extracted every `"handler":` value (32 distinct handlers referenced by cron entries).
- Listed `agents/may/handlers/` (34 `.ts` files present).
- Cross-referenced via `ls` + `grep -rn handler-name src/ agents/`.
- Queried `.state/may.db` (`sessions` table, last 7 days) for evidence of dispatch/activity.

## Findings Table

| Handler name              | cron.json status                                       | Handler file                             | Last-observed effect (7d)                                                                 | Verdict  |
|---------------------------|--------------------------------------------------------|------------------------------------------|-------------------------------------------------------------------------------------------|----------|
| `priority-drift`          | **NOT referenced** (no entry)                          | `agents/may/handlers/priority-drift.ts:1-14` (14425 bytes) | No sessions; no scheduling. Only refs are doc/design files (`DESIGN-guards-v2.md:690`, `research-sensor-judge-workflow.md:63`). | **ORPHAN — delete** |
| `project-resume`          | **NOT referenced** (removed 2026-04-17 in commit `2b17074ca`; see `agents/.git` log) | `agents/may/handlers/project-resume.ts:1-5` (6383 bytes) | Last cron-sourced run `2026-04-17T16:27:12Z` (DB query on `sessions` where `source='cron'`). No dispatches since entry removal. | **ORPHAN — delete** (safe; cron.json no longer triggers it) |
| `error-log-scanner`       | `enabled: false` (cron.json:369) — "DEPRECATED: replaced by error-scan sensor-judge workflow. Kept for rollback." | `agents/may/handlers/error-log-scanner.ts:1` (14825 bytes) | No sessions in 7d. Superseded by `error-scan` (cron.json:378 `handler: run-workflow`). | **DEAD-WEIGHT — schedule removal after 1 more week of `error-scan` stability** |
| `coaching-feedback`       | `enabled: false` (cron.json:437) — "DEPRECATED — migrated to coaching-feedback-wf sensor-judge workflow. Kept for rollback." | `agents/may/handlers/coaching-feedback.ts:1` (5822 bytes) | No sessions in 7d. Superseded by `coaching-feedback-wf` (cron.json:448). | **DEAD-WEIGHT — schedule removal after 1 more week** |

All other 32 handlers referenced in cron.json have corresponding files in `agents/may/handlers/` and are enabled. No case (a) — every `"handler": "X"` value resolves to an existing file. No other case (c) was found in the 7d DB scan: all enabled handlers either produced sessions or are pure-JS jobs (no session spawned by design, e.g. `session-sync`, `metrics-snapshot`).

## Evidence Citations

- cron.json entry count and layout: `agents/may/cron.json:1-476` (46 entries, scanned in single read).
- `error-log-scanner` deprecation note: `agents/may/cron.json:366-374` (`"enabled": false`, `"description": "DEPRECATED: Replaced by error-scan sensor-judge workflow. Kept for rollback."`).
- `coaching-feedback` deprecation note: `agents/may/cron.json:437-446` (`"enabled": false`, `"description": "DEPRECATED — migrated to coaching-feedback-wf sensor-judge workflow. Kept for rollback."`).
- `error-scan` replacement: `agents/may/cron.json:376-387` (`handler: run-workflow`, `workflow: error-scan`).
- `coaching-feedback-wf` replacement: `agents/may/cron.json:448-460` (`handler: run-workflow`, `workflow: coaching-feedback`).
- `project-resume` entry removal: `agents/.git` commit `2b17074ca` (2026-04-17 16:36 UTC) deleted the `project-resume` cron block (verified via `git show 2b17074ca -- may/cron.json`).
- `project-resume.ts` still present: `agents/may/handlers/project-resume.ts:153` still contains `[cron:project-resume] Resume your active project.` task template — handler is dormant code.
- `priority-drift.ts` orphan: no `"handler": "priority-drift"` string anywhere in `cron.json` (grep returned 0 matches); handler body in `agents/may/handlers/priority-drift.ts:47` references `workspace/priority-drift-report.md` which also has no cron driver.
- DB query (7d): `bun:sqlite` on `.state/may.db`, `SELECT source, COUNT(*) FROM sessions WHERE task LIKE '%cron:project-resume%' AND startedAt > now-7d GROUP BY source` → 67 `cron`-sourced, latest `2026-04-17T16:27:12Z` (before removal commit).
- Handler registration logic: `src/app/agent-loader.ts:687-760` (`loadAgentHandlers`) iterates `cron.getEntries()` and only resolves handlers referenced by cron entries — orphan handler files are never imported, confirming they have zero runtime effect.

## Recommended Actions (DO NOT execute in this session)

1. **Delete `agents/may/handlers/priority-drift.ts`** (14 KB). No cron wiring, no callers. The only design references are in workspace docs (`DESIGN-guards-v2.md`, `research-sensor-judge-workflow.md`) which describe it as a reference example — those remain valid as prose without the stub.
2. **Delete `agents/may/handlers/project-resume.ts`** (6 KB). Cron entry was removed 2026-04-17 (commit `2b17074ca`); handler is now unreachable. Note: the task-class still appears in optimizer findings (`finding-workflow-health-20260417-1600.md`) because those findings predate the cron removal; no action needed there.
3. **Schedule removal (not now) of `error-log-scanner.ts` + its cron entry** and **`coaching-feedback.ts` + its cron entry**. Both are kept for rollback. Recommend: after 14 days of stable workflow-based replacements (target date 2026-04-28), delete both handler files and their `enabled: false` cron entries.

## Follow-Up (separate sessions)

- **FIX-1** (small, tech-lead or coder): single-commit PR deleting `priority-drift.ts` + `project-resume.ts`. Verify `npm run check` passes; verify `loadAgentHandlers` still registers the same count. Target: review/<id> branch, 1 file each deletion.
- **FIX-2** (defer to 2026-04-28): sweep of deprecated handlers + cron stubs.

## Scope Discipline

No broader refactor was attempted. No code was modified. Budget: ~16 ops, under the 20-op cap.
