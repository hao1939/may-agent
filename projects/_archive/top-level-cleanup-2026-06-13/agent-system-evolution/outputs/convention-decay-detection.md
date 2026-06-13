# Convention Decay Detection — Iteration 9

## Methodology
Sampled 15 completed sessions from the last 48h. Checked each for:
1. **Finish-contract compliance**: Did the session call finish() with verification_evidence and deliverables?
2. **Delegation-memo compliance**: Did sessions that performed fork/call use context_files/success_criteria?
3. **Graceful-degradation compliance**: Did sessions ending in failure/partial emit checkpoints or partial results?

## Session Sample (15 sessions)

| # | Session ID | Agent | Finish Called | verification_evidence | deliverables |
|---|-----------|-------|:---:|:---:|:---:|
| 1 | s_1779370089431_285 | evaluator | ✅ | ✅ (18) | ✅ (8) |
| 2 | s_1779369927872_284 | evaluator | ✅ | ✅ (13) | ✅ (3) |
| 3 | s_1779369902586_283 | evaluator | ✅ | ✅ (3) | ✅ (5) |
| 4 | s_1779369676130_282 | may | ✅ | ✅ (1) | ✅ (2) |
| 5 | s_1779369676097_281 | evaluator | ✅ | ✅ (2) | ✅ (2) |
| 6 | s_1779369626318_280 | evaluator | ✅ | ✅ (5) | ✅ (24) |
| 7 | s_1779369432743_279 | evaluator | ✅ | ✅ (1) | ✅ (17) |
| 8 | s_1779369268567_278 | evaluator | ✅ | ✅ (13) | ✅ (2) |
| 9 | s_1779369091623_277 | tech-lead | ✅ | ✅ (3) | ✅ (3) |
| 10 | s_1779369047341_276 | may | ✅ | ✅ (4) | ✅ (3) |
| 11 | s_1779369043329_275 | evaluator | ✅ | ✅ (1) | ✅ (1) |
| 12 | s_1779369041927_274 | evaluator | ✅ | ✅ (2) | ✅ (2) |
| 13 | s_1779369022127_273 | scout | ❌ | ❌ | ❌ |
| 14 | s_1779369022027_271 | may | ❌ | ❌ | ❌ |
| 15 | s_1779368928047_266 | evaluator | ✅ | ✅ (23) | ✅ (5) |

## Results

### Finish-Contract Quality
- **Compliance rate: 87% (13/15)**
- Baseline (iteration 6): 100%
- **Regression: -13%** — 2 sessions (scout heartbeat, may heartbeat) completed without calling finish()
- Both non-compliant sessions were heartbeat sessions (opCount 6-13) that ended without formal finish calls despite producing done outcome

### Delegation-Memo Convention
- **Compliance rate: N/A (0 delegations in sample)**
- Baseline (iteration 6): 0%
- No session in this sample performed fork/call delegations via the `agents` tool
- 5 sessions contained `context_files`/`success_criteria` mentions (from their own task prompts, confirming the dispatch-fix is injecting these into incoming tasks)
- **Conclusion**: The dispatch-fix is working (context appears in task prompts), but this sample didn't include sessions that delegate outward

### Graceful-Degradation Convention  
- **Compliance rate: N/A (0 failure/partial sessions in sample)**
- Baseline (iteration 6): 0%
- All 15 sampled sessions completed successfully — no opportunity to observe graceful-degradation behavior
- **Conclusion**: Cannot measure improvement; would need to specifically sample failed sessions

## Comparison to Iteration 6 Baseline

| Contract | Iter-6 Baseline | Iter-9 Current | Change |
|----------|:-:|:-:|:-:|
| Finish-contract | 100% | 87% | ⚠️ **-13% regression** |
| Delegation-memo | 0% | N/A (no delegations) | — |
| Graceful-degradation | 0% | N/A (no failures) | — |

## Key Findings

1. **Finish-contract regression in heartbeat sessions**: Two heartbeat sessions (scout, may) did not call finish() despite completing successfully. This suggests heartbeat sessions have weaker finish-contract enforcement than task sessions.

2. **Dispatch-fix validated**: context_files and success_criteria appear in task prompts (visible in 5 sessions), confirming the dispatch-path-delegation-fix from iteration 7 is active.

3. **Sample bias**: The 48h window produced mostly evaluator aftermath sessions (9/15) and project-owner/task sessions (6/15). No outward delegations or failures occurred, making delegation-memo and graceful-degradation unmeasurable.

## Recommendations

1. **Heartbeat finish enforcement**: Heartbeat sessions should still use finish() — the convention should be reinforced in heartbeat workflow prompts or treated as an acceptable exception (heartbeats are lightweight).

2. **Targeted sampling needed**: Future decay-detection should specifically query for fork/call sessions and failure/partial sessions to measure delegation-memo and graceful-degradation.

3. **No action needed on delegation-memo or graceful-degradation**: Cannot identify decay because the behaviors weren't triggered in this sample window.
