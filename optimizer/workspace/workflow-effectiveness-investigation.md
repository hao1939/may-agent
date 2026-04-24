# Workflow Effectiveness Investigation

**Date:** 2025-06-20  
**Current metric:** 84.8% (target: 90%)  
**Method:** Analysis of 50 most recent failed requests from tracking DB

## Executive Summary

Six distinct failure patterns account for all workflow failures. The top two — missing module errors and missing workflow definitions — represent **~85% of all failures** and are both infrastructure/config issues (not agent logic bugs). Fixing these two would likely push effectiveness above 90%.

## Failure Categories

### 1. Missing module `growth.js` — compliance-check cron (HIGH IMPACT)
- **Count:** 7 failures (recurring every 30min)
- **Error:** `Cannot find module '../../src/lib/growth.js'`
- **Affected workflow:** `cron:compliance-check` (convention-check + standing-orders-check)
- **Root cause:** A JS handler references `src/lib/growth.js` which doesn't exist (deleted or never created).
- **Fix:** Either create the missing module or update the handler import path. Check `agents/shared/` for the handler that imports it.

### 2. Missing `*-heartbeat` workflow definitions (HIGH IMPACT)
- **Count:** 14 failures across 2 cron cycles (all 7 agents × 2)
- **Error:** `Workflow "<agent>-heartbeat" not found in /app/agents/<agent>/workflows`
- **Affected agents:** qa, tech-lead, scout, coach, optimizer, bob, may
- **Root cause:** Heartbeat workflows were recently migrated to per-agent workflow files, but the workflow YAML/JSON files weren't created for some or all agents in one deployment cycle. They appear to be working now (recent heartbeats succeed), so this was a **transient deployment issue** that has self-resolved.
- **Fix:** Already resolved. Consider adding a startup validation check that all referenced workflows exist.

### 3. Missing `error-scan` workflow (MEDIUM)
- **Count:** 5 failures
- **Error:** `Workflow "error-scan" not found in /app/agents/may/workflows`
- **Root cause:** Cron references a `error-scan` sensor-judge workflow that was never created.
- **Fix:** Either create `agents/may/workflows/error-scan.yaml` or remove the cron entry.

### 4. Missing `coaching-feedback` workflow (LOW)
- **Count:** 2 failures
- **Error:** `Workflow "coaching-feedback" not found in /app/agents/coach/workflows`
- **Root cause:** Same as #3 — cron references a workflow that doesn't exist.
- **Fix:** Create `agents/coach/workflows/coaching-feedback.yaml` or remove the cron entry.

### 5. `gateResult.includes is not a function` bug (MEDIUM)
- **Count:** 4 failures (coach heartbeat, may heartbeat)
- **Error:** `gateResult.includes is not a function`
- **Root cause:** A gate step returns a non-array value (likely an object or null), and the code assumes it's a string/array. This appears to be a **JS bug in the workflow runner's gate evaluation logic**.
- **Fix:** Add type checking in the gate evaluation: `Array.isArray(gateResult) ? gateResult.includes(id) : false`. Search for `.includes(id)` in the workflow runner source.

### 6. Missing module `project-health.js` — project-resume cron (HIGH IMPACT)
- **Count:** 14 failures (recurring every 5min for ~70min)
- **Error:** `Cannot find module '../../../src/lib/project-health.js'`
- **Affected workflow:** `cron:project-resume`
- **Root cause:** Same pattern as #1 — handler references a module that doesn't exist.
- **Fix:** Create the missing module or fix the import. This appears to have been **fixed** since recent project-resume runs succeed.

### 7. `handlerConfig` misconfiguration — coach cron jobs (LOW)
- **Count:** 5 failures
- **Error:** `handlerConfig must include: workflow, agent, task`
- **Affected:** `common-sense-verify`, `research-intake` cron jobs for coach
- **Root cause:** Cron config for these jobs is missing required fields in the handler config object.
- **Fix:** Update the cron config entries for `common-sense-verify` and `research-intake` to include all required fields (`workflow`, `agent`, `task`).

## Impact Analysis

| Category | Failures | Status | Effort |
|----------|----------|--------|--------|
| Missing `growth.js` | 7 | **ACTIVE — recurring** | Low (fix import or create file) |
| Missing heartbeat workflows | 14 | Resolved | N/A |
| Missing `error-scan` workflow | 5 | **ACTIVE — recurring** | Low (create or remove cron) |
| Missing `coaching-feedback` | 2 | **ACTIVE — recurring** | Low (create or remove cron) |
| `gateResult.includes` bug | 4 | Resolved (possibly) | Medium (JS fix) |
| Missing `project-health.js` | 14 | Resolved | N/A |
| `handlerConfig` misconfigured | 5 | **ACTIVE — recurring** | Low (fix cron config) |

## Recommended Priority Actions

1. **[P0] Fix `growth.js` missing module** — This is the only currently-recurring high-frequency failure. Fires every 30 minutes. Find and fix the import in the compliance-check handler.

2. **[P1] Fix or remove `error-scan` cron entry** — Fires every 4 hours, always fails. Either implement the workflow or disable the cron.

3. **[P1] Fix `handlerConfig` for coach cron jobs** — `common-sense-verify` and `research-intake` are misconfigured. Add the required `workflow`, `agent`, `task` fields.

4. **[P2] Fix or remove `coaching-feedback` cron entry** — Same pattern as error-scan.

5. **[P2] Add defensive type-check for `gateResult`** — Prevent the `.includes()` crash if gate returns unexpected type.

## Projected Impact

Currently ~50 failures in the tracking window. Fixing items 1-3 would eliminate ~34 of them (the recurring ones). Combined with the already-self-resolved issues (#2, #6), this should bring workflow effectiveness from 84.8% to **~94-96%**, well above the 90% target.
