# Heartbeat Analysis: Experiment Pipeline Unblock (2025-05-04b)

## System State
- 0 active projects (H-250 busywork loop still valid)
- 100% handler success rate, 8/8 heartbeat coverage — system healthy but idle
- Evaluator dominates compute (71/99 recent sessions)

## Experiment Pipeline Audit

### Stalled Experiments Ready to Move

| Experiment | Status | What's Needed | Impact |
|-----------|--------|---------------|--------|
| **EXP-850** (Summarize-Before-Reread) | DESIGNED | Phase 0 baseline: 5 gym trials on multi-file-refactor | High — reduces token waste across all agents |
| **EXP-745** (Few-Shot Pattern Coverage) | Phase 2 COMPLETE | Phase 3 gym validation: 3 baseline + 3 treatment trials | Medium — already at 90% match rate, need quality proof |
| **EXP-580** (SOUL.md VAW Placement) | DEPLOYED-PARTIAL | Deploy to optimizer SOUL.md, measure 20 sessions | Medium — tests SOUL.md as intervention vector |

### Key Finding: Experiment-to-Production Gap

Pattern across all three stalled experiments:
1. Design phase completes quickly (1-2 sessions)
2. Gym execution stalls because no one dispatches the trials
3. Results sit un-acted-on even when positive (EXP-745 Phase 2: +45pp improvement, still not validated)

**Root cause**: No automated experiment progression. Each phase requires a manual heartbeat decision to continue. When projects close and heartbeats shift to analysis mode, experiments lose momentum.

### Proposed Fix: Experiment Dispatch Protocol

Add to bob's periodic tasks:
- **Every 3rd heartbeat**: Check experiment tracker. For any experiment in DESIGNED or PHASE_N_COMPLETE status:
  - If gym scenario exists → dispatch trials to coach
  - If gym scenario missing → create it or notify coach
  - If stalled >1 week → kill or redesign

## Immediate Actions for Next Session

1. **EXP-850 Phase 0**: Check if `multi-file-refactor` gym scenario exists. If yes, dispatch 5 baseline trials.
2. **EXP-745 Phase 3**: Design validation protocol and dispatch 3+3 trials.
3. **Consider new project**: "experiment-pipeline-health" — systematic unblocking of stalled experiments.

## H-250 Update

The busywork loop hypothesis remains valid. This is session ~16+ of analysis-only output from bob. The experiment pipeline IS the path out — shipping experiments that change agent behavior is the most direct way to produce non-self-referential value.

**Decision**: Focus next session on EXP-850 Phase 0 dispatch rather than more analysis.
