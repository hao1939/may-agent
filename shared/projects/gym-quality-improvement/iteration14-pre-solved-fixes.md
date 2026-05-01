# Iteration 14: Pre-Solved Scenario Fixes

**Date**: 2026-12-01
**Focus**: Fix 3 pre-solved scenarios that pass without agent intervention (M7 metric)

## Changes Made

### 1. `efficient-file-reading` — FIXED
- **Problem**: `environment/report.md` already contained the expected output (degraded services report with exact format required by criteria)
- **Fix**: Deleted `environment/report.md`. Now the agent must actually read `services.yaml` and `monitor.log` to produce the report.

### 2. `research-and-report` — FIXED  
- **Problem**: `environment/synthesis-report.md` already contained a complete synthesis report matching criteria expectations
- **Fix**: Deleted `environment/synthesis-report.md`. Now the agent must actually read the papers in `environment/papers/` and synthesize them.

### 3. `sql-injection-in-query-builder-f1` — FIXED
- **Problem**: Code already had `escapeSQL()` function applied (SQL injection pre-fixed) AND `|| []` null guards (crash bug pre-fixed). Agent had nothing to do.
- **Fix**: Reverted to vulnerable state:
  - Removed `escapeSQL()` function entirely
  - Removed `|| []` null guards from `searchProducts` and `searchByCategory`
  - Removed `Number()` coercion from `getProductById`
  - Now has both bugs: SQL injection via raw interpolation AND null crash on empty results

### 4. `incomplete-migration` — N/A
- Does not exist as a scenario directory. Was likely a misidentification in iteration 12's notes.

## Metrics Update
- **M7 (Pre-solved scenario rate)**: 3 → 0 ✅ (all fixed)
- **M6 (Broken scenario rate)**: remains ~3.3% (1/30)

## Next Steps
- Run second 30-scenario sweep on different scenarios to validate catalog-wide health
- Mark regressing workflow variants as ❌ in LIBRARY.md
