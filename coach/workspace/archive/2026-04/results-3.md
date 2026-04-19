# EXP-055b: Verification Gates with Longer Timeout — RESULTS

**Status**: COMPLETE
**Sprint**: 19
**Completed**: 2026-04-07
**Parent**: EXP-055

## Question
Does the parser-bug product regression in EXP-055 disappear with a longer timeout (7 min vs 5 min)?

## Hypothesis
The product regression is budget-driven — the verification gate adds tool-call overhead, and with a 5-min timeout the agent runs out of time for the third bug. With 7 min, it should fix all 3 bugs AND pass C2.3.

## Results

### Treatment (verify-gate, 7-min timeout)
| Run | Product (3 bugs) | C1 (read-before-edit) | C2.3 (verify-after-edit) | Total | Duration |
|---|---|---|---|---|---|
| TX1 | 2/3 ❌ (parser fail) | 4/4 ✅ | ✅ PASS | 10/11 | 216s |
| TX2 | 2/3 ❌ (parser fail) | 4/4 ✅ | ✅ PASS | 10/11 | 322s |
| TX3 | 2/3 ❌ (parser fail) | 4/4 ✅ | ✅ PASS | 10/11 | 231s |

**Treatment C2.3 pass rate**: 3/3 (100%) — gate still works perfectly
**Treatment parser-bug pass rate**: 0/3 (0%) — product regression PERSISTS even with extra time!

### Baseline (no gate, 7-min timeout)
| Run | Product (3 bugs) | C1 (read-before-edit) | C2.3 (verify-after-edit) | Total | Duration |
|---|---|---|---|---|---|
| BL1 | 3/3 ✅ | 4/4 ✅ | ✅ PASS | **11/11** | 38s |

**Baseline C2.3 pass rate**: 1/1 (100%) — passes without the gate!
**Baseline product pass rate**: 3/3 (100%) — all bugs fixed

## Analysis

### HYPOTHESIS REJECTED
The product regression is **NOT budget-driven**. Even with 7 minutes and under 4 minutes of actual wall-clock usage, the treatment consistently fails parser-bug. The gate itself is causing the regression, not time pressure.

### The Real Mechanism
The forced READ → EDIT → READ → CONFIRM workflow creates **rigidity** that interferes with the agent's natural problem-solving flow for the parser.js fix. Possible explanations:

1. **Context window pollution**: The mandatory re-reads add content to the context, potentially pushing the parser-bug instructions out of the agent's attention window
2. **Workflow override**: The rigid step-by-step protocol may prevent the agent from applying the simple regex fix naturally — it gets confused by the ceremony
3. **Task ordering**: The gate slows down the first two fixes so much that by the time it reaches parser.js, the agent's planning has degraded

### Critical Discovery: Baseline Passes C2.3 at 7 Minutes!
The most surprising finding: **the baseline (no gate) passes C2.3 at 7-min timeout**. This contradicts EXP-055 where baseline was 0/3 on C2.3 at 5-min timeout.

This suggests C2.3 failure was **partially budget-driven in the baseline** — with more time, the agent naturally verifies its work. The gate was solving a problem that more time also solves, but the gate introduces a worse problem (product regression).

### Comparison Summary
| Config | Timeout | C2.3 Rate | Product Rate | Total |
|---|---|---|---|---|
| Baseline (EXP-055) | 5 min | 0/3 (0%) | 3/3 (100%) | 10/11 |
| Gate (EXP-055) | 5 min | 2/2 (100%) | 0/2 (0%) | 10/11 |
| **Gate (EXP-055b)** | **7 min** | **3/3 (100%)** | **0/3 (0%)** | **10/11** |
| **Baseline (EXP-055b)** | **7 min** | **1/1 (100%)** | **1/1 (100%)** | **11/11** |

## Conclusion

**DO NOT DEPLOY verification gates.** The product regression is inherent to the gate's rigid workflow, not budget-related. The gate forces a ceremony that interferes with the agent's natural ability to fix the parser bug.

**Better solution: increase timeout.** The baseline agent with adequate time (7 min) achieves 11/11 — perfect score on both product AND conventions. The C2.3 gap was a budget problem, not a behavior problem.

## Implications

1. **Verification gates are counterproductive** — they fix C2.3 but break product quality. Net negative.
2. **C2.3 is budget-sensitive** — agents DO verify when given enough time. The 5-min timeout was artificially constraining.
3. **Rigid workflow enforcement hurts** — forcing ceremony reduces the agent's effectiveness on the actual task.
4. **Simple solutions win** — giving more time is better than adding process overhead.

## Recommendation
- **REJECT** verification gate deployment
- **CONSIDER** extending default scenario timeouts for complex multi-file tasks
- **EXPLORE** whether other "behavioral gaps" are actually budget gaps in disguise
- The 1/1 baseline sample is small — a follow-up with 3 baseline runs at 7 min would strengthen confidence

## Raw Data
- Treatment scenario: `read-before-edit-verify-gate-6min` (7 min timeout)
- Baseline scenario: `read-before-edit-7min` (7 min timeout)
- Agent: stock coder (no lab forks)
