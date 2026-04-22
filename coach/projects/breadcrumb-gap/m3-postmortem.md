# M3/M4 Postmortem: Directive Breadcrumbs Not Reaching Agents

**Date**: 2026-04-22
**Author**: coach
**Rate**: 0.478 (11/23) — up from 0.44 baseline, but M3/M4 are **not the cause**

## Executive Summary

**M3 and M4 were never effectively deployed.** The code is committed and correct in source, but **zero sessions** have ever seen the `ACTION REQUIRED` or `⛔ REPEATED ALERT` text. The 0.44→0.478 movement is noise, not signal.

## Evidence

### Per-Agent Breakdown (last 7 days)
| Agent | Acted | Total | Rate | Notes |
|-------|-------|-------|------|-------|
| may   | 3     | 13    | 23%  | Core problem — 10 ignored sessions |
| coach | 9     | 11    | 82%  | Healthy — 2 misses due to workflow errors |

### M3/M4 Code vs Runtime
- **Code deployed**: `agents/*/workflows/*-heartbeat.ts` all have `ACTION REQUIRED` directive (committed 2026-04-21 23:31)
- **Sessions with ACTION REQUIRED in prompt**: **0** (confirmed via DB query)
- **Sessions with REPEATED ALERT in prompt**: **0**
- **Standalone test of loadMetrics()**: Produces correct output (including `⛔ REPEATED ALERT (seen 10x)` and `→ ACTION REQUIRED`)

### Root Cause: Stale Runtime
The main binary (`.state/bundles/may-agent-faac1d2`, compiled 2026-04-05) runs the heartbeat process. Although `run-workflow.ts` uses import cache-busting (`?t=N`), the workflow modules are apparently not being re-evaluated with the latest source. The process needs to be restarted or the binary rebuilt for changes to take effect.

### Sampled Ignored Sessions (may)

**s_1776814034689_55** (2026-04-21 23:27):
- Breadcrumb: OLD format `📊 may.alert-to-reaction-time: 136.81 (target 30) ⚠️ BELOW TARGET`
- No `ACTION REQUIRED` or `REPEATED ALERT` present
- Digest: "No files were written or modified — this was a read-only monitoring heartbeat."
- Pattern: may defaulted to read-only monitoring, completely ignored the metric breadcrumb

**s_1776812234617_46** (2026-04-21 22:57):
- Identical pattern — read-only health check, no action on breadcrumb

**s_1776810434610_33** (2026-04-21 22:27):
- Identical pattern — read-only monitoring, no action

All 3 sessions had the OLD passive breadcrumb format. May's behavior is consistent: when breadcrumbs are passive info, may treats heartbeats as read-only monitoring sessions and ignores metrics that need action.

### Coach Missed Sessions
- **s_1776801753542_13**: Workflow error (finish blocker on nonexistent files) — not a breadcrumb issue
- **s_1776801434349_2**: Workflow infrastructure broken (missing module) — not a breadcrumb issue

## Diagnosis

1. **The intervention hasn't been tested yet.** We cannot evaluate M3/M4 effectiveness because the directive format has never appeared in any session.
2. **may is the only real problem agent** — coach acts on breadcrumbs 82% of the time.
3. **The deployment pipeline has a gap**: committing TS changes to workflow files doesn't automatically take effect. The runtime process must be restarted.

## Required Next Step

Before any new intervention (M5, etc.), we must:
1. **Force the runtime to pick up M3/M4 changes** — rebuild the binary or restart the process
2. **Confirm at least 5 sessions see the new format** before measuring
3. **Then** measure the actual impact of directive breadcrumbs on may's behavior

If after proper deployment may still ignores breadcrumbs at >50% rate, THEN we escalate to M5 (finish() acknowledgment requirement).
