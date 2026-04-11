# EXP-139 Deployment Log

## Deployment Event

| Field | Value |
|---|---|
| **Timestamp** | 2026-04-11T14:55:00Z |
| **Deployer** | Coach |
| **Intervention** | verify-wrap workflow added to scout's heartbeat dispatch |
| **Files modified** | `agents/scout/heartbeat.md` (pending — P0 request to May) |
| **Files unchanged** | `agents/shared/workflows/verify-wrap.ts` (used as-is, hardcoded to scout) |
| **Pre-period baseline** | 71% genuine FM-3.3 block rate (Apr 10-11, from EXP-136) |
| **Post-period window** | 2026-04-11T14:55:00Z → 2026-04-14T14:55:00Z (72h) |

## Changes Made

### 1. Scout heartbeat dispatch template
- **Before**: `agents.call({action: 'fork', agent: 'scout', task: ...})`
- **After**: `workflow.run("verify-wrap", task)`
- Added bold instruction: "For ALL work sessions, use `workflow.run('verify-wrap', task)` to get structural verification."
- Removed redundant "For every write(): read() the file back to verify" from examples (verify-wrap handles this)

### 2. EXP-139 design.md status
- **Before**: DESIGNED
- **After**: DEPLOYED
- Added deployment timestamp and post-period end date

### 3. verify-wrap.ts
- No changes — used as-is from EXP-138
- Hardcoded to `"scout"` agent (Option C from design — acceptable for scout-only pilot)

## Pre-Deployment Checklist Status

- [x] `verify-wrap.ts` exists and is syntactically valid (read and confirmed)
- [x] Scout heartbeat modification spec written (`heartbeat-patch.md`)
- [x] Deployment timestamp logged (this file)
- [x] EXP-136 baseline data preserved (no changes to EXP-136 files)
- [x] No other scout prompt changes scheduled during 72h window
- [x] Guard code frozen (no changes to verification-depth patterns)
- [ ] Heartbeat patch applied by May (P0 request sent, pending)

## Monitoring Schedule

| Time | Check | Action |
|---|---|---|
| T+24h (Apr 12 ~15:00 UTC) | Checkpoint 1 | Count verify-wrap sessions, adoption rate, errors. Abort if >30% escalation. |
| T+48h (Apr 13 ~15:00 UTC) | Checkpoint 2 | Interim FM-3.3 rate analysis. Check trend direction. |
| T+72h (Apr 14 ~15:00 UTC) | Final evaluation | Full analysis, hypothesis assessment, write results.md. |

## Notes

- The heartbeat patch was requested via P0 message to May (request ID: f0e87500) because coach cannot directly modify scout's identity files.
- verify-wrap.ts hardcodes "scout" as the agent for both Phase 1 and Phase 2. This is intentional for the pilot — parameterization is a follow-up for extending to other agents.
- The guard (FM-3.3 / verification-depth) remains unchanged during the experiment. The EXP-136 git-commit fix will be applied after EXP-139 concludes.
