# EXP-550: Structural Intervention Stack — Cumulative Effectiveness Audit

**Date**: 2026-06-02  
**Author**: coach  
**Status**: DESIGNED  
**Type**: Measurement (no new intervention)

## Problem

Five structural interventions were deployed in May 2026:
- **EXP-500**: Read-before-edit auto-injection (master-worker.ts:423-448) — CLOSED POSITIVE (0% edit failures)
- **EXP-510**: Worker completion requirements (master-worker.ts:451) — CLOSED POSITIVE (write 76%, finish 69%)
- **EXP-520**: Heartbeat artifact gate (heartbeat-data.ts:438-459) — CLOSED POSITIVE (100% recovery)
- **EXP-530**: Verification gate (master-worker.ts) — CLOSED POSITIVE (100% recovery on 6/6)
- **EXP-540**: Path normalization rule (master-worker.ts:451) — DEPLOYED, unmeasured

These were measured individually at deployment. We need to verify:
1. They still work after ~1 week of production use (no regression)
2. Combined stack doesn't cause interference (prompt too long, conflicting rules)
3. EXP-540 specifically has reduced path violations

## Method

### Phase 1: Session Log Audit

Audit the 2 available session logs for evidence of structural interventions firing:
- `.state/sessions/s_1776014661800_2260/session.jsonl`
- `.state/sessions/s_1777290130694_91/session.jsonl`

Look for:
- Artifact gate triggers (EXP-520)
- Verification behavior (reads after writes)
- Path compliance (no absolute paths)
- finish() call presence and quality

### Phase 2: Gym Regression Test

Run 3 convention scenarios to verify structural behaviors hold:
```bash
cd /app/agents && export GYM_AGENT_BIN=/usr/local/bin/may-agent
bash test/gym/run-gym.sh output-format-compliance --timeout 10
bash test/gym/run-gym.sh convention-verify-multi-edit-workflow-gated --timeout 10
```

Check: verify-after-edit, output format, finish compliance

### Phase 3: EXP-540 Specific Measurement

Search all available session data for path violations post-deployment:
- Count instances of `/Users/`, `/home/`, `/root/`, `~/` in recent sessions
- Compare to pre-deployment rate (60.9% violation)

## Success Criteria

- Phase 1: ≥2 sessions audited with structural behavior evidence
- Phase 2: ≥80% pass rate on convention scenarios (no regression from EXP-370's 95%)
- Phase 3: EXP-540 path violation rate established (target: ≤20%)

## Timeline

- Phase 1: This session
- Phase 2: This session (if gym available)
- Phase 3: This session (if session data available)

## Dependencies

- Session JSONL files accessible
- Gym runner functional (`GYM_AGENT_BIN=/usr/local/bin/may-agent`)
