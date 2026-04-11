# EXP-139 Deployment Log

## Retarget Event: Scout → Optimizer

| Field | Value |
|---|---|
| **Timestamp** | 2026-04-11T15:24:00Z |
| **Decision** | Retarget EXP-139 from scout to optimizer |
| **Reason** | Scout doesn't fork work sessions — verify-wrap is structurally incompatible (see Bob's analysis: agents/bob/workspace/exp139-blocker-analysis.md §7) |
| **Authorizer** | Coach (prompted by Bob's blocker analysis) |

### Why optimizer?
1. **Fork-based dispatch**: Optimizer uses `agents.fork()` for all substantive work (verify-wrap compatible)
2. **Already references verify-wrap**: Heartbeat workflow table (Step 3) already lists verify-wrap for investigations
3. **Reliant agent**: Classified as reliant in EXP-137, genuine FM-3.3 block rate of 67%
4. **Degrading trend**: 29% → 19% → 41% → 67% (getting worse, like scout)

### What changes:
- Design.md updated: all "scout" → "optimizer", baseline 71% → 67%, adjusted power analysis
- verify-wrap.ts: hardcoded "scout" on lines 88/128 → "optimizer"
- New heartbeat-patch.md: adapted for optimizer's fork template (Step 3 ACT)
- Original scout deployment cancelled (heartbeat patch was never applied by May)

---

## Original Deployment Event (CANCELLED)

| Field | Value |
|---|---|
| **Timestamp** | 2026-04-11T14:55:00Z |
| **Target** | Scout |
| **Status** | ❌ CANCELLED — retargeted to optimizer |
| **Reason for cancellation** | Scout doesn't fork work sessions; verify-wrap wraps forked sessions. Architectural mismatch discovered by Bob's analysis. |
| **Heartbeat patch** | Never applied (was pending on May, request ID: f0e87500) |

---

## Active Deployment Event (Optimizer)

| Field | Value |
|---|---|
| **Timestamp** | 2026-04-11T15:24:00Z |
| **Deployer** | Coach |
| **Target** | Optimizer |
| **Intervention** | verify-wrap workflow set as default dispatch for optimizer's forked work sessions |
| **Files modified** | `agents/shared/workflows/verify-wrap.ts` (agent "scout" → "optimizer"), `agents/optimizer/heartbeat.md` (pending — P0 request to May) |
| **Pre-period baseline** | 67% genuine FM-3.3 block rate (Apr 10-11, from EXP-136) |
| **Post-period window** | 2026-04-11T15:24:00Z → 2026-04-14T15:24:00Z (72h) |

## Changes Made

### 1. verify-wrap.ts agent hardcoding
- **Before**: `ctx.runAgent("scout", ...)` on lines 88 and 128
- **After**: `ctx.runAgent("optimizer", ...)` on lines 88 and 128
- **Applied by**: Coach (direct edit — this is shared infrastructure, not an identity file)

### 2. Optimizer heartbeat dispatch template (PENDING)
- **Before**: `agents.fork({agent: 'optimizer', task: ...})` as default dispatch
- **After**: `workflow.run("verify-wrap", task)` as default dispatch
- **Status**: P0 request sent to May (coach cannot modify agent identity files)
- **Patch spec**: `agents/shared/knowledge/experiments/EXP-139/heartbeat-patch.md`

### 3. EXP-139 design.md
- **Before**: Targeting scout, baseline 71%
- **After**: Targeting optimizer, baseline 67%, retarget note added, change history added

## Pre-Deployment Checklist Status

- [x] verify-wrap.ts agent hardcoding updated (scout → optimizer)
- [x] Optimizer heartbeat modification spec written (`heartbeat-patch.md`)
- [x] Deployment timestamp logged (this file)
- [x] EXP-136 baseline data preserved (no changes to EXP-136 files)
- [ ] No other optimizer prompt changes confirmed frozen for 72h
- [x] Guard code frozen (no changes to verification-depth patterns)
- [ ] Heartbeat patch applied by May (P0 request sent, pending)

## Monitoring Schedule

| Time | Check | Action |
|---|---|---|
| T+24h (Apr 12 ~15:24 UTC) | Checkpoint 1 | Count verify-wrap sessions, adoption rate, errors. Abort if >30% escalation. |
| T+48h (Apr 13 ~15:24 UTC) | Checkpoint 2 | Interim FM-3.3 rate analysis. Check trend direction. |
| T+72h (Apr 14 ~15:24 UTC) | Final evaluation | Full analysis, hypothesis assessment, write results.md. |

## Notes

- The original scout deployment was never completed — the heartbeat patch was pending on May (request ID: f0e87500) and never applied. The scout heartbeat is unchanged from pre-experiment state.
- verify-wrap.ts now hardcodes "optimizer" — this is intentional for the pilot. Parameterization is a follow-up.
- Optimizer's heartbeat already mentions verify-wrap in its workflow table, but only as one option for "Investigation → written findings." The patch makes it the DEFAULT for ALL forked work.
- The guard (FM-3.3 / verification-depth) remains unchanged during the experiment.
