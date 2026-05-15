# Breadcrumb Gap Analysis — Root Cause & Fix

**Date**: 2026-05-28  
**Status**: Fixed  
**Metric**: coach.breadcrumb-action-rate (was 0.31 bogus → now 0.20 real → expected to rise to ~0.80 with fix)

## Problem Statement

Context-discovery breadcrumbs achieve ~100% action rate in gym scenarios but only ~10-20% in production. Why?

## Root Causes Found

### 1. Measurement Script Was Deeply Flawed (Fixed)

**File**: `agents/coach/scripts/measure-breadcrumb-action-rate.sh`

Three bugs in the old measurement:

| Bug | Impact |
|-----|--------|
| `task LIKE "%⚠️%"` matched old-format sessions where ⚠️ appeared in heartbeat.md (self-reference warnings, section headers) — not actual metric breadcrumbs | Inflated denominator with non-breadcrumb sessions |
| `agent IN (SELECT owner FROM metrics WHERE current < threshold)` used *current* metric values retroactively for all historical sessions | Included sessions where agent had no red metrics at the time |
| Action patterns (`/fix/i`, `/dispatch/i`, `/analyz/i`) matched any productive session | Inflated numerator — "analyzed code" counted as "acted on breadcrumb" |

**Fix**: New script uses `metric_snapshots` table to check if agent had below-target metrics *at session time*, and tighter action patterns requiring metric-specific language.

### 2. Production Breadcrumbs Were Missing the "Crumb Trail" (Fixed)

**Gym breadcrumb** (100% action rate):
```
stuck-requests: 76, target: 0 ⚠️ NEEDS ATTENTION
  → Quick check: read environment/stuck-requests.json for breakdown by cause
```

**Production breadcrumb** (before fix):
```
📊 bob.experiment-completion: 0.45 (target 0.8) ⚠️ BELOW TARGET
```

The production metric line had the *flag* (⚠️ BELOW TARGET) but not the *trail* (→ Quick check: ...). The `source_query` and `source_command` fields existed in the database but weren't surfaced.

**Fix**: `loadMetrics()` now includes `→ Quick check` hints from source_query/source_command for below-target metrics.

### 3. Production Lacked the G-Pattern Forcing Function (Fixed)

**Gym G-pattern** (100% action rate):
> "**Question**: Which metric above is furthest from its target? Follow the '→ Quick check' breadcrumb for that metric NOW"

**Production** (before fix):
> "Review your metrics, check your projects, do your job. Act on what matters."

The gym scenario forced the agent to answer a specific question about metrics *before* doing anything else. Production just listed metrics passively.

**Fix**: All heartbeat workflows now inject a G-pattern question block when below-target metrics are detected:
```
## ⚡ FIRST — evaluate your red metrics before anything else

**Question**: Which metric above is furthest from its target? Follow the "→ Quick check" 
breadcrumb for that metric NOW — run the command or query. Then decide: is this urgent 
enough to act on this heartbeat, or can it wait?
```

## Files Changed

| File | Change |
|------|--------|
| `agents/coach/scripts/measure-breadcrumb-action-rate.sh` | Rewrote measurement to use metric_snapshots for point-in-time accuracy |
| `agents/*/workflows/*-heartbeat.ts` (8 files) | Added breadcrumb trails + G-pattern question for red metrics |

## Expected Impact

- **Immediate**: Measurement will accurately reflect ~20% baseline (current real rate)
- **Within 1 week**: Rate should climb to 60-80% as G-pattern + breadcrumb trails take effect
- **Evidence basis**: Gym scenarios show G-pattern achieves 80-100%; production gap was structural, not behavioral
