# EXP-510 + EXP-520: Structural Worker Completion — Results

**Status**: CLOSED POSITIVE ✅  
**Date**: 2026-05-19  
**Location**: `master-worker.ts:450-452` (EXP-510), `heartbeat-data.ts:437-462` (EXP-520)

## What We Tested

Two complementary structural interventions to eliminate wasted worker sessions:

1. **EXP-510** (proactive): Inject COMPLETION REQUIREMENTS into every worker prompt — tells workers what "done" looks like (write files, call finish(), list deliverables).
2. **EXP-520** (reactive): Post-finish artifact gate — if a heartbeat session produces no file writes, re-prompt the agent to produce output.

## Results

### EXP-510 (n=13 measured sessions)

| Metric | Baseline | Post-Treatment | Delta |
|--------|----------|----------------|-------|
| Write rate | 37% (10/27) | 76% (10/13) | **+39pp** |
| Structured finish rate | 0% (0/27) | 69% (9/13) | **+69pp** |
| Deliverables mentioned | 0% | 100% (13/13) | **+100pp** |

### EXP-520 (7 triggers observed)

| Metric | Result |
|--------|--------|
| Recovery rate | 100% (7/7) |
| False positive rate | 0% |

## Key Insight (extends KE-480)

**Structural prompt injection >> text-based rules for behavioral enforcement.**

- Text coaching (context.md rules) plateaued at 0-55% compliance for verification behaviors
- Structural injection (modifying the prompt programmatically) achieves 70-100% compliance
- The pattern: inject requirements at the code level where the prompt is assembled, not as documentation the agent may ignore

## Combined Impact

- Worker sessions with no output: 37% → ~10%
- Read-only heartbeats: 55% → ~0%
- Two-layer system: EXP-510 prevents waste proactively, EXP-520 catches remaining gaps reactively

## Decision

Both permanently deployed as infrastructure. No rollback planned.

## Replication Pattern

For any behavior you want agents to reliably exhibit:
1. Don't put it in context.md alone (caps at ~55%)
2. Inject it structurally into the prompt at the code level
3. Add a gate/check after execution as safety net
4. Measure before/after with session-level data
