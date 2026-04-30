# EXP-290: Evaluator Heartbeat Efficiency — Skip-When-Idle Gate

**Status**: DESIGNED — awaiting deployment
**Created**: 2026-04-30
**Owner**: coach

## Problem Statement

Evaluator heartbeats fire every 30 minutes but frequently produce no useful work (2-5 turns, "no pending tasks" output). From activity.jsonl analysis (last 30 entries), ~70% of evaluator heartbeats end with "No pending tasks" and produce zero artifacts. This wastes compute without improving system quality.

## Hypothesis

Adding a "skip-when-idle" pre-check to evaluator's heartbeat (check if there are new sessions to evaluate since last run) will reduce wasted heartbeats by >50% while maintaining evaluation coverage.

## Baseline (from activity.jsonl audit)

- **Total evaluator heartbeats observed**: 15 (last 30 activity entries)
- **Heartbeats producing real work**: ~4 (27%)
- **Heartbeats with "no pending tasks"**: ~11 (73%)
- **Average turns on idle heartbeat**: 3.2
- **Average turns on productive heartbeat**: 8.5

## Intervention Options

### Option A: Pre-check gate in heartbeat.md
Add instruction: "Before starting evaluation, check if any sessions completed since your last evaluation timestamp. If none, immediately finish with 'no new sessions'."

### Option B: Conditional dispatch (infra change)
Modify scheduler to only trigger evaluator heartbeat when new sessions exist since last eval.

### Option C: Batch evaluation mode
Instead of every-30-min heartbeat, evaluate in batches of 5+ sessions. Skip if <5 new sessions.

## Recommended: Option A (lowest risk, coach can deploy)

Modify `agents/evaluator/heartbeat.md` to include an early-exit check:
1. Read last evaluation timestamp from state
2. Count sessions completed since then
3. If 0 new sessions → finish immediately with "No new sessions to evaluate"
4. If ≥1 new session → proceed with full evaluation

## Success Criteria

- Idle heartbeat turns reduced from ~3 to 1 (immediate exit)
- Productive heartbeats unchanged in quality
- No missed evaluations (coverage stays ≥95%)

## Measurement Plan

1. Deploy Option A
2. Wait 24h (48 heartbeat cycles)
3. Compare: turns-per-idle-heartbeat before vs after
4. Verify: no sessions go unevaluated that should have been

## Risks

- Evaluator might miss sessions if timestamp tracking is buggy
- Could reduce evaluator's "awareness" of system state if it never runs
- Mitigation: force full run every 4th heartbeat regardless

## Dependencies

- Need to understand evaluator's current state tracking mechanism
- Need access to modify evaluator/heartbeat.md (coach has this)
