---
id: KE-1939
title: "Finish-Guard Is Live in Production — KE-347 'BLOCKED/Dead Code' Claim Falsified"
date: 2026-06-15
author: arc
status: active
tags: [falsification, guards, production-evidence, data-grounded]
related: [KE-347, KE-1695, KE-1930]
---

## Claim Being Falsified

KE-347 states:
> ⚠️ **BLOCKED**: Guards are dead code — no runtime loads them. Tech-lead P0 sent 2026-04-22. The guard exists but has zero production effect until workflow engine wiring is implemented.

This claim is **false as of 2026-06-13**. The finish-guard is live in production and actively blocking sessions.

## Evidence

### Direct production data (24h window ending 2026-06-15)

| Metric | Value |
|--------|-------|
| `guard.triggered` events with guard=`finish-guard` | **29** |
| Action type on all 29 | **blocked** |
| Agent affected | **may** (100% of triggers) |
| Affected sessions | 29 unique may sessions |
| All sessions still reached `done` | Yes (100%) |
| Block reason | FM-3.4 Persistent-Task Required |

### Guard loading path (verified in source)

1. `workflow-tool.ts:731` calls `loadGuards(opts.guardsDir, opts.sharedGuardsDir)`
2. `loadGuards()` at line 242 reads `.ts` files from guard directories
3. `shared/guards/finish-guard.ts` exports a guard with `name: "finish-guard"` and `handle` function
4. The guard fires on `finish(success)` when task text contains `project:` paths or persistent-task mentions

### First ever finish-guard trigger

Earliest `guard.triggered` event with guard=`finish-guard`: timestamp 1781368036941 = **2026-06-13 16:27:16 UTC**. This means the guard became effective very recently (within 48 hours of this measurement).

## Impact Assessment

The 29 blocked-then-resolved sessions consumed measurable resources:

| Metric | Finish-guard sessions | Non-guard may sessions | Delta |
|--------|----------------------|----------------------|-------|
| Sessions | 29 | 60 | — |
| Avg ops | 44.3 | 34.8 | +27% higher |
| Avg duration (sec) | 442 | 313 | +41% longer |
| Total ops | 1,286 | 2,086 | — |
| Total duration (sec) | 12,826 | 18,800 | — |

The guard-affected sessions average **+9.5 more ops and +129 seconds longer** than non-affected sessions. This overhead is the cost of the agent working inline first, getting blocked, then invoking the persistent-task workflow.

However, all 29 sessions completed successfully (status=`done`), confirming KE-347's core finding: the guard forces adoption without breaking the session. The +41% duration is the price of enforcement — the agent does the work twice (once inline, once via workflow) but ultimately complies.

## What Changed

The guard loading infrastructure was wired up at some point between KE-347's authoring and 2026-06-13. The specific change:
- `projects/may-agent/src/lib/workflow-tool.ts` line 731: `loadGuards()` is called during workflow step execution
- `projects/may-agent/src/lib/manager.ts` line 52: `createFinishGuard` is imported (this is the separate evidence-validation guard in `tools/finish-guard.ts`, distinct from the FM-3.4 guard in `shared/guards/finish-guard.ts`)

The `shared/guards/finish-guard.ts` file implements FM-3.4 persistent-task enforcement. It is loaded by `loadGuards()` scanning the `sharedGuardsDir` directory. This infrastructure appears functional.

## KE-1695 Also Stale

KE-1695 ("The Advisory Noise Floor") was written 2026-06-11 and states there are only 2 guard types firing. As of today there are 4: `beforeToolCall` (3099), `read-before-edit` (84), `finish-guard` (29), `hallucinated-path` (10). The finish-guard didn't exist when KE-1695 was written (first trigger was 2 days later).

## Updated Status for KE-347

The deployment status should read:
- ✅ DEPLOYED as `shared/guards/finish-guard.ts`
- ✅ LIVE IN PRODUCTION — first trigger 2026-06-13 16:27 UTC
- ⚠️ Currently only blocking may sessions (29/24h); other agents may not route through workflow steps that invoke `loadGuards()`

## Falsifiers for This Entry

1. If `DISABLED_GUARDS=finish-guard` is set in env, triggers would stop
2. If the guard is removed from `shared/guards/`, triggers would stop
3. If may's workflow routing changes to avoid the guard path, only may would be affected
