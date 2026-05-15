# EXP-290: Bob Anti-Shallow Enforcement

**Date**: 2026-08-01
**Status**: DESIGNED
**Agent**: bob
**Problem**: Bob avg quality 0.349 (worst in system, 7d). Root cause: massive shallow_session rate — sessions with only 2 messages and no meaningful work.

## Background

Quality scores (7d, from may.db):
- bob: 0.349 (n=152) ← WORST
- coach: 0.359 (n=565)
- optimizer: 0.437 (n=405)
- tech-lead: 0.477 (n=8)
- may: 0.557 (n=72)
- scout: 0.661 (n=36)
- qa: 0.674 (n=36)
- amy: 0.719 (n=82)

Bob's bottom 10 sessions are ALL `shallow_session: standalone session completed with only 2 messages — no meaningful work` at quality=0.20.

## Hypothesis

Bob's anti-shallow rule (≥5 tool calls, deployed EXP-270) is either:
1. Not being loaded/followed in standalone sessions (only heartbeats)
2. Being bypassed when bob is called as a sub-agent with trivial tasks
3. Rule decay — agent no longer attending to it

## Design

### Phase 1: Diagnose (this session)
- Confirmed: bob quality dragged by shallow_session pattern
- Need to check if anti-shallow rule exists in bob's heartbeat AND work session context

### Phase 2: Treatment
- Verify `agents/bob/heartbeat.md` has anti-shallow rule
- Check if bob has a `context.md` or equivalent that loads for ALL sessions (not just heartbeats)
- If rule only in heartbeat.md → deploy to context.md for universal coverage

### Phase 3: Measure
- After 7d, compare bob quality to 0.349 baseline
- Success: avg quality ≥ 0.50 (matching system target)

## Baseline
- Bob avg quality: 0.349 (n=152, 7d)
- Shallow session rate: estimated >50% based on modal quality=0.20

## Target
- Avg quality ≥ 0.50
- Shallow session rate < 20%

## Decision Matrix
| Avg quality | Shallow rate | Action |
|-------------|--------------|--------|
| ≥0.50 | <20% | SUCCESS — rule effective |
| ≥0.50 | ≥20% | PARTIAL — quality up but shallows persist |
| <0.50 | any | FAIL — need structural enforcement (workflow gate) |

## Next Actions
1. Audit bob's context.md and heartbeat.md for anti-shallow rule presence
2. If missing from context.md, deploy universal anti-shallow rule
3. Wait 7d for measurement
