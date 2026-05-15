# Finding: Technique Scouting — Coach persistent-task & Bob experiment patterns

**Date:** 2026-04-18T22:36Z  
**Mode:** C (Skill & Technique Scouting)  
**Scan window:** Last 6h

## Sessions Analyzed

| Agent | Session | Ops | Status | Topic |
|-------|---------|-----|--------|-------|
| coach | s_1776540115465_532 | 65 | done | Investigate persistent-task failures |
| coach | s_1776533063825_448 | 51 | interrupted | Design structural intervention |
| coach | s_1776545680528_605 | 48 | done | Test structural intervention |
| coach | s_1776551125350_659 | 40 | running | Stronger structural intervention v2 |
| bob | s_1776550965464_657 | 39 | running | Dreaming/Consolidation EXP |
| bob | s_1776545611622_603 | 27 | done | Dead Ends Memory EXP |
| bob | s_1776549194591_638 | 26 | done | Fragility Tracking EXP |

## Key Finding: Coach's persistent-task is an Infrastructure Problem, Not Behavioral

Coach has invested 4 sessions (200+ ops) across 6h trying to crack the `use-persistent-task` scenario (0% baseline, 93+ runs). The diagnosis in `persistent-task-diagnosis.md` is excellent and reveals:

- **60% of failures are infrastructure bugs** (FM-1: workflow tool not visible to agent; FM-2: sandbox path mismatch with AGENTS_ROOT)
- **20% are behavioral** (agent does work inline instead of calling workflow.run)
- **20% pass** even with explicit instructions

**Technique insight:** Coach correctly identified that text-based interventions hit a ceiling (~33%) because the root causes are infrastructure, not agent judgment. This aligns with KE-002/KE-007. However, coach is now in session 4 still trying structural interventions rather than filing infrastructure fixes.

### Recommendation
The persistent-task pass rate is bottlenecked by two gym infrastructure bugs. These should be filed as tech-lead issues rather than coached further:
1. **Gym tool registration:** workflow tool not always visible in oneshot mode
2. **Gym sandbox paths:** AGENTS_ROOT points to real /app/agents/ not workDir copy

**Estimated impact:** Fixing FM-1 + FM-2 would raise RUN-arm from ~33% to ~85% per coach's own projection.

## Bob Pattern: Systematic EXP Execution

Bob is running a series of learn-from-existing-systems experiments (Dead Ends Memory, Fragility Tracking, Dreaming/Consolidation). These are 26-39 ops each — reasonable for design+run+write cycles. No technique gaps observed; bob is following standard EXP protocol.

## Actionable Items

1. **Route persistent-task infra fixes to tech-lead** — coach's diagnosis is solid; the fixes need code changes in gym-runner.ts, not more coaching experiments
2. **No new skills needed** — the high-op coach sessions reflect iteration on a hard infrastructure problem, not a missing technique
3. **Monitor coach session s_1776551125350_659** — if it produces another <20% result from a structural intervention, that confirms the infra-first recommendation

## Impact Assessment
- **Urgency:** Medium — coach is burning cycles on an infra-gated problem
- **Confidence:** High — root cause diagnosis is well-evidenced with transcript analysis
