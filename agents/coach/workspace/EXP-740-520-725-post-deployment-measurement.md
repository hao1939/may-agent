# Post-Deployment Measurement: Gates EXP-740 / EXP-520 / EXP-725

**Date**: 2026-05-06
**Author**: coach
**Status**: AWAITING DATA

## Context

Three quality gates were recently deployed to `heartbeat-data.ts` (commit 925bc7bbb + 72a2cf6fe):

| Gate | EXP | What It Does | Trigger Condition |
|------|-----|-------------|-------------------|
| Wall-clock duration | EXP-740 | Re-prompts sessions completing < 90s | `durationSec < 90` |
| Artifact gate (fixed) | EXP-520 | Re-prompts sessions with no file writes | No write/edit tool calls AND no agents/workflow delegation |
| Anti-shallow gate | EXP-725 | Re-prompts sessions with < 10 tool calls | `toolCallCount < MIN_TOOL_CALLS` |

Additionally, an **impact gate** (EXP-735) checks for multi-edit sessions without downstream verification.

## What We Need to Measure

### 1. Trigger Rates
- How often does each gate fire?
- Expected: artifact gate should fire less often after EXP-520 fix (removed false-positive keywords)
- Log files: `shared/duration-gate-triggers.log`, `shared/anti-shallow-gate-triggers.log`, `shared/impact-gate-triggers.log`

### 2. Effectiveness (True vs False Positives)
For each trigger:
- Was the re-prompt justified? (true positive)
- Did the agent actually improve after re-prompt? (effectiveness)
- Did the gate fire on a session that had already done good work? (false positive)

### 3. Behavioral Change
- Are agents proactively avoiding shallow sessions (anticipating gates)?
- Has average tool-call count per session increased since deployment?
- Has average session duration increased?

## Measurement Protocol

### Phase 1: Collect Trigger Data (passive, 1-2 weeks)
Wait for trigger log files to accumulate entries. Need ≥20 total gate triggers across all three gates.

**Check command:**
```bash
wc -l agents/shared/*-gate-triggers.log 2>/dev/null
```

### Phase 2: Audit Triggers (active, 1 session)
For each trigger entry:
1. Find the corresponding session transcript
2. Score: TP (gate correctly caught shallow work) or FP (gate fired on adequate work)
3. Score re-prompt effectiveness: did agent produce better output after re-prompt?

### Phase 3: Write Results KE
Compare to baseline from experiment audit:
- EXP-300/302/303: text nudges achieved 3-10% compliance
- EXP-550: SOUL.md placement achieved 22→77% for declarative behaviors
- EXP-650: diminishing returns text gate achieved 0% compliance

**Key question**: Do structural gates (auto-re-prompt) outperform text nudges?
Expected: YES — structural enforcement bypasses compliance problem entirely.

## Success Criteria
- Combined false-positive rate ≤ 20%
- Re-prompt improves output in ≥ 60% of true-positive triggers
- No gate fires > 3x on same session (would indicate infinite loop risk)

## Baseline (pre-deployment)
From skill-workflow-audit project:
- verify-after-write compliance (text skill): 9%
- read-before-edit compliance (text skill): 34%
- verify-before-finish compliance (structural guard): 99%

**Hypothesis**: Structural gates will achieve 80%+ effective compliance (agent behavior changes after gate fires), far exceeding text-only approaches.

## Dependencies
- Gate trigger log files must be written (code deployed, needs live sessions)
- Session transcripts must be accessible for audit
- Need ≥20 triggers for statistical significance

## Timeline
- Phase 1: Now through 2026-05-20 (passive collection)
- Phase 2: 2026-05-20 (audit session)
- Phase 3: 2026-05-21 (write KE)
