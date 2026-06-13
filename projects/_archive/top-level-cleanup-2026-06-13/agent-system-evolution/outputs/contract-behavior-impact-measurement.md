# Contract Behavior Impact Measurement

**Date**: 2026-05-25  
**Methodology**: Sampled 15 most recent completed sessions, scored each against 4 published contracts.

## Sessions Sampled

| # | Session | Agent | Task Type |
|---|---------|-------|-----------|
| 1 | s_…242 | may | Project Owner Loop |
| 2 | s_…238 | evaluator | Metric Alert Triage |
| 3 | s_…237 | evaluator | Evaluator Aftermath |
| 4 | s_…241 | may | contract-consolidation-index |
| 5 | s_…240 | may | graceful-degradation-adoption-check |
| 6 | s_…239 | may | task-continuity-checkpoint-validation |
| 7 | s_…235 | evaluator | Evaluator Aftermath |
| 8 | s_…236 | may | Project Owner Loop |
| 9 | s_…233 | evaluator | Evaluator Aftermath |
| 10 | s_…234 | may | score-compression-fix-adoption |
| 11 | s_…232 | may | delegation-memo-enforcement |
| 12 | s_…231 | may | task-continuity-contract |
| 13 | s_…229 | evaluator | Evaluator Aftermath |
| 14 | s_…230 | may | Project Owner Loop |
| 15 | s_…228 | may | multi-session-task-continuity |

## Scoring Rubric

| Contract | What's Measured | Pass Criteria |
|----------|----------------|---------------|
| **Delegation Memo** | fork/call includes context_files + success_criteria | Structured fields present in delegation parameters |
| **Finish Contract** | verification_evidence, deliverables, concrete summary | Per rubric in outputs/finish-contract-quality-rubric.md |
| **Graceful Degradation** | Checkpoint emission before heavy ops, partial-result preservation | ≥1 checkpoint for sessions with 10+ ops |
| **Task Continuity** | Checkpoint file created/read for multi-session tasks | Checkpoint file exists at `outputs/checkpoint-<task-id>.md` |

## Per-Session Scores

| Session | Delegation Memo | Finish Contract | Graceful Degradation | Task Continuity |
|---------|:-:|:-:|:-:|:-:|
| s_…242 | ❌ (0 context_files in forks) | ✅ | N/A (9 ops) | N/A (single session) |
| s_…238 | N/A | ✅ (blocked w/ evidence) | N/A (evaluator) | N/A |
| s_…237 | N/A | ✅ | N/A (10 ops, evaluator) | N/A |
| s_…241 | N/A (no delegation) | ✅ | N/A (4 ops) | N/A |
| s_…240 | N/A (no delegation) | ✅ | ❌ (19 ops, no checkpoint) | N/A |
| s_…239 | N/A (no delegation) | ✅ | ❌ (17 ops, no checkpoint) | N/A |
| s_…235 | N/A | ✅ | ❌ (12 ops, no checkpoint) | N/A |
| s_…236 | ❌ (0 context_files) | ✅ | N/A (10 ops) | N/A |
| s_…233 | N/A | ✅ | N/A (10 ops) | N/A |
| s_…234 | N/A | ✅ | ❌ (16 ops, no checkpoint) | N/A |
| s_…232 | N/A | ✅ | ❌ (27 ops, no checkpoint) | N/A |
| s_…231 | N/A | ✅ | N/A (7 ops) | N/A |
| s_…229 | N/A | ✅ | ❌ (17 ops, no checkpoint) | N/A |
| s_…230 | ❌ (0 context_files) | ✅ | N/A (9 ops) | N/A |
| s_…228 | N/A | ✅ | ❌ (13 ops, no checkpoint) | N/A |

## Aggregate Compliance Rates

| Contract | Applicable Sessions | Passing | Rate |
|----------|:--:|:--:|:--:|
| **Delegation Memo** | 3 (sessions that fork/call with task params) | 0 | **0%** |
| **Finish Contract** | 15 | 15 | **100%** |
| **Graceful Degradation** | 7 (sessions with ≥12 ops) | 0 | **0%** |
| **Task Continuity** | 0 (no multi-session tasks in sample) | — | **N/A** |

**Overall weighted compliance: 50%** (averaging across 3 scoreable contracts)

## Weakest Contract: Delegation Memo (0% adoption)

Despite the enforcement patch injecting a "Delegation Memo" reminder into all fork/call prompts, **zero sessions actually pass `context_files` or `success_criteria` as structured parameters** in their fork/call tool invocations. The project-owner-loop sessions dispatch tasks via the workflow system which doesn't set these fields. The injected text is informational only — there's no structural enforcement preventing dispatch without these fields.

### Runner-up: Graceful Degradation (0% adoption)

No session with 10+ operations emits mid-session checkpoints. The `.state/checkpoints/` directory has legacy files but none from recent sessions. The contract requires platform-level auto-checkpoint support (R1-R4) which remains unimplemented.

## Root Causes

1. **Delegation Memo**: The project-task dispatch workflow bypasses the agents tool entirely — tasks are dispatched by the master-worker scheduler which doesn't use the fork/call API with structured fields. The enforcement in `manager-agents-tool.ts` only applies to agent-initiated delegations.

2. **Graceful Degradation**: No agent prompt currently instructs checkpoint behavior. The contract defines it as a platform capability (grace-turn hook) that doesn't exist yet. Without platform support, voluntary adoption is zero.

3. **Task Continuity**: The auto-checkpoint platform features (R1-R4) are unimplemented. No `outputs/checkpoint-<task-id>.md` files are being created by the workflow system.

## Recommendations

1. **Delegation Memo**: Shift enforcement to the master-worker dispatch path (not just agent-initiated forks). The workflow scheduler should populate `context_files` when dispatching project tasks.
2. **Graceful Degradation**: Add checkpoint discipline to agent system prompts as interim measure; prioritize platform grace-turn implementation.
3. **Task Continuity**: Implement R1 (auto-create checkpoint on first dispatch) as the minimal viable enforcement.

## Conclusion

The **finish-contract** is the only convention with material adoption (100%). The remaining three contracts are effectively unimplemented — they define aspirational behavior that requires platform changes not yet shipped. The weakest contract by impact gap is **delegation-memo** because it has an attempted enforcement mechanism that fails to reach the actual dispatch path.
