# Finding: seed-metrics.ts is 100% dead weight

**Date**: 2026-04-16  
**Target**: `scripts/seed-metrics.ts` (433 LOC)  
**Severity**: Low (no runtime impact, but maintenance/confusion risk)

## Summary

`seed-metrics.ts` is entirely stale. It defines 20 metrics with **old-style IDs** (e.g., `quality.coder`, `gym.pass-rate`, `health.error-rate`) that no longer exist in the database. The M1 seeding task replaced them with 25 **role-aligned metrics** (e.g., `coder.quality`, `bob.experiment-completion`, `tech-lead.build-health`). The script served its one-time purpose and has been superseded.

## Evidence

1. **DB has 25 metrics, none matching seed-metrics.ts IDs**:
   - DB IDs: `bob.designs-implemented`, `coder.quality`, `scout.coverage`, `tech-lead.build-health`, etc. (25 total)
   - Script IDs: `quality.coder`, `quality.bob`, `gym.pass-rate`, `health.error-rate`, etc. (20 total)
   - **Zero overlap** between script definitions and DB contents.

2. **Nothing imports from it**: Searched `src/**/*.ts` and all agents — no imports, no references in code. Only mentioned in workspace planning docs (todo.md, project files).

3. **Schema DDL is duplicated**: The script's `SCHEMA_SQL` (lines 33-76) creates `metrics`, `metric_snapshots`, `metric_alerts`, and `research_log` tables — these are already managed by the main migration system.

4. **Source queries reference tables that may not exist**: e.g., `gym_runs`, `convention_checks`, `experiments`, `hypotheses` — leftover from the pre-M1 design.

## What's dead

| Component | Lines | Status |
|-----------|-------|--------|
| Old metric definitions array | ~200 LOC | 100% stale — none match DB |
| Schema DDL block | ~45 LOC | Duplicated from migrations |
| Insert/validate/summary logic | ~80 LOC | Only useful for old metrics |
| **Entire file** | **433 LOC** | **Fully dead** |

## Recommended Action

**Delete `scripts/seed-metrics.ts`** entirely. The M1 seeding was done by a different mechanism (direct DB inserts in the M1 session). If re-seeding is ever needed, the current DB state is the source of truth, not this file.

## Follow-up

- [ ] Delete `scripts/seed-metrics.ts` (separate session)
- [ ] Check if any CI/Makefile/package.json scripts reference it
