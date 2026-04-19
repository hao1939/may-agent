# Codebase Weight Fragility Analysis

**Date:** 2026-04-19  
**Severity:** Low (informational — no blast radius)

## Summary

The "codebase weight" metric (target 32000 lines, current ~31988) has **no enforcement mechanism**. Exceeding 32000 lines causes no breakage, no blocking, and no alert. The target is purely advisory — a "soft cap" visible in heartbeat context.

## Evidence

1. **Metric definition**: `refine-metrics-2026-04-18.ts:56-62` defines `Codebase weight` with `target: 32000`, `threshold: null`, and `alert_direction: "above"`.

2. **DB record confirms**: The metric is stored as `type: "continuous"` with `threshold: null` (queried from `metrics` table, row `tech-lead.codebase-weight`).

3. **Alert check skips it**: `metrics-snapshot.ts:187` — `if (metric.type !== "health" || metric.threshold == null) return false;` — because type is `"continuous"` (not `"health"`) AND threshold is null, the health-breach check never fires. No alert is created when the value exceeds 32000.

4. **Regression check is trend-based**: `metrics-snapshot.ts:162-165` — continuous metrics use a rolling-average regression check (`checkContinuousRegression`), which fires only on *significant relative change* from recent average, not on absolute threshold breach. If LOC grows slowly (e.g., +50/day), no regression alert fires.

5. **No pre-commit or CI guard**: No reference to `32000` or `codebase weight` exists anywhere in `src/`, `.github/`, or `.husky/` — there is no commit-blocking mechanism.

6. **Heartbeat visibility only**: `heartbeat-context.md:33` shows `Codebase weight: **31988** lines → 32000 lines`. This is displayed during tech-lead heartbeats as context, but the tech-lead agent must manually notice and act on it.

## What happens if 32000 is exceeded

**Nothing breaks.** The metric value updates to >32000 on the next snapshot. The heartbeat context will show current > target. The tech-lead agent may or may not notice or act. No alert, no block, no degradation.

## Blast radius

Zero. This is a vanity/awareness metric with no downstream effects.

## Recommended follow-up

No action needed. The metric is working as designed — it's a *soft cap* per `metrics-definitions.md:22` ("Not a hard threshold — just a 'if you're over, consider trimming' marker"). If a hard cap is desired in the future, set `threshold: 32000` and change type to `"health"` so `metrics-snapshot.ts:187-194` fires an alert on breach.
