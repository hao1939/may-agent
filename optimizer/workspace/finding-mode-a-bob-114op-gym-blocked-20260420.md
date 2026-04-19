# Finding: Bob 114-op EXP-188 Session Blocked on Missing API Key

**Date**: 2026-04-20
**Mode**: A (Session Archaeology)
**Session**: s_1776625869047_0 (bob, 114 ops, quality 0.1)

## Summary

Bob spent 114 ops attempting to run EXP-188 (Recognition Intervention Dose-Response) on sql-injection-in-query-builder. The entire session was wasted because `ANTHROPIC_API_KEY` wasn't available in the environment — the gym runner requires `may-agent-bin` which needs this key.

The session outcome explicitly states: "I'm blocked. The gym runner requires the `may-agent-bin` binary to execute scenarios, but it fails with 'Agent not registered. Available: ' (empty list) because there's no ANTHROPIC_API_KEY in the environment."

## Root Cause

**Missing pre-flight validation in gym workflows.** The agent attempted gym runs repeatedly before discovering the fundamental blocker. A 1-op check at session start (`env | grep ANTHROPIC` or a dry-run) would have saved 113 ops.

## Impact

- **Direct waste**: 114 ops × ~$0.047/op ≈ $5.36 for zero output
- **Pattern frequency**: This is the same pre-flight validation gap identified in `finding-coach-experiment-cost-scouting-0412.md` — still unfixed
- **Recurrence risk**: HIGH — any experiment session without API key will burn similar ops

## Other High-Op Sessions (6h)

| Session | Agent | Ops | Quality | Note |
|---------|-------|-----|---------|------|
| s_1776625869047_0 | bob | 114 | 0.10 | Blocked on missing API key |
| s_1776624114564_0 | optimizer | 68 | 0.80 | workflowRunId tracking investigation |
| s_1776622109230_2 | optimizer | 57 | 0.78 | Workflow-first persistent task |
| s_1776611458057_11 | tech-lead | 48 | — | Metric system bugs fix |
| s_1776627035821_436 | coach | 48 | 0.62 | Agent-autonomy persistent task |

The optimizer 68-op session was investigating a real infrastructure gap (workflowRunId tracking). The tech-lead 48-op session fixed P0 metric bugs. Both are legitimate work.

## Recommendations

### R1: Pre-flight env check in gym-batch.sh and gym-run.sh (DISPATCH-READY)
Add a 3-line check at the top of `scripts/gym-run.sh` and `scripts/gym-batch.sh`:
```bash
if [ -z "$ANTHROPIC_API_KEY" ]; then
  echo "ERROR: ANTHROPIC_API_KEY not set. Gym runs require this." >&2
  exit 1
fi
```
**Target**: tech-lead
**Impact**: Prevents all future 100+ op gym sessions that discover missing key late

### R2: NO_DISPATCH for other sessions
All other high-op sessions in the window are doing legitimate work. No intervention needed.
