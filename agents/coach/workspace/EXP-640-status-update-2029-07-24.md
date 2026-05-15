# EXP-640: Duration Gate Analysis — 2029-07-24 Update

## Current State: BLOCKED (binary not rebuilt)

The duration gate in `heartbeat-data.ts` lines 463-511 **never fires in production** because the runtime binary has not been rebuilt since the TS source was edited.

## Code Logic Analysis

The gate's firing conditions are:
1. `tooFewTurns`: `turnsUsed > 0 && turnsUsed < 3` — **NEVER TRUE** because `turnsUsed` is always 0 (ctx.runAgent() doesn't populate it)
2. `looksTrivia`: `turnsUsed === 0 && summaryLength < 200` — fires if summary is short

### Reachability Issue

The EXP-520 artifact gate (lines 440-462) fires and returns early when `!hasDeliverables && !mentionsWrite`. This means:
- Sessions with no deliverables → caught by artifact gate, never reach duration gate
- Sessions WITH deliverables but short summary → would hit `looksTrivia`

So `looksTrivia` CAN fire on sessions that game the artifact gate (produce a trivial deliverable with a short summary). This is the intended behavior per the EXP-640 FIX comments.

## Evidence Binary Not Rebuilt

- `agents/shared/duration-gate-triggers.log` does not exist
- Multiple short sessions have occurred since deployment
- Gate should have fired (looksTrivia: sessions with trivial deliverables + <200 char summaries exist)

## Blocker

Runtime binary (`may-agent` or equivalent) not rebuilt. Escalated to tech-lead:
- Original escalation: 2029-07-23
- Re-escalation: 2029-07-24

## Impact

Without this gate:
- EXP-640 cannot measure production firing rate
- EXP-650 (structural impact-scanning gate) cannot be deployed
- Gate-gaming sessions continue unchecked
