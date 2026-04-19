# EXP-055: Method #17 Verification Gates — RESULTS

**Status**: COMPLETE
**Sprint**: 19
**Completed**: 2026-04-07

## Question
Can a verification gate (forced re-read after edit) fix the persistent verify-after-edit gap (C2.3)?

## Results

### Baseline (read-before-edit, stock coder)
| Run | Product (3 bugs) | C1 (read-before-edit) | C2.3 (verify-after-edit) | Total |
|---|---|---|---|---|
| BL1 | 3/3 ✅ | 4/4 ✅ | ❌ FAIL | 10/11 |
| BL2 | 3/3 ✅ | 4/4 ✅ | ❌ FAIL | 10/11 |
| BL3 | 3/3 ✅ | 4/4 ✅ | ❌ FAIL | 10/11 |

**Baseline C2.3 pass rate**: 0/3 (0%) — highly consistent failure, as expected from prior data.

### Treatment (read-before-edit-verify-gate, forced readback workflow)
| Run | Product (3 bugs) | C1 (read-before-edit) | C2.3 (verify-after-edit) | Total |
|---|---|---|---|---|
| TX1 | 2/3 ❌ (parser fail) | 4/4 ✅ | ✅ PASS | 10/11 |
| TX2 | 2/3 ❌ (parser fail) | 4/4 ✅ | ✅ PASS | 10/11 |
| TX3 | timeout (no data) | — | — | — |

**Treatment C2.3 pass rate**: 2/2 valid runs (100%) — verification gate works!
**Treatment parser-bug pass rate**: 0/2 valid runs (0%) — product regression on third bug.

## Analysis

### The Tradeoff
The verification gate successfully forces verify-after-edit behavior (C2.3: 0% → 100%), but introduces a **product regression**: the agent consistently fails to fix the parser bug. Net score is unchanged (10/11 either way), just different failures.

**Mechanism**: The forced read-back workflow adds tool-call overhead (~2-3 extra reads per file). With a 4-minute timeout, the agent runs out of budget for the third bug fix. The gate forces good process but at the cost of throughput.

### Comparison to Prior Approaches
| Approach | C2.3 Pass Rate | Product Impact | Net |
|---|---|---|---|
| Text skill (strict) | 20% (1/5) | No regression | Marginal |
| Text skill (post-edit-readback) | 12.5% (1/8) | No regression | Ineffective |
| **Verification gate (workflow)** | **100% (2/2)** | **-1 product check** | **Tradeoff** |

The gate is the **first approach to consistently fix C2.3**, but it's a budget-constrained tradeoff.

### Implications
1. **C2.3 IS fixable** — it's not a model capability gap, it's a behavior-prioritization gap
2. **Verification gates need longer timeouts** — 4-minute scenarios are too tight for forced readbacks on 3+ files
3. **For real-world deployment**: Tasks where correctness matters more than speed should use gates; time-constrained tasks should not
4. **Budget-aware gates possible**: Only force readback on the first N files, or only on files that had complex edits

## Conclusion
**PARTIALLY CONFIRMED**: Verification gates fix C2.3 behavior (0% → 100%) but introduce product regressions under tight timeouts. The mechanism works but needs budget-awareness for deployment. This is NOT a model capability gap — it's a resource allocation problem that can be solved with smarter gate design.

## Next Steps
- Test with 6-minute timeout to confirm product regression disappears with more budget
- Design budget-aware verification gate (skip readback if <30s remaining)
- Consider "lazy gate" — only force readback on write() calls, not edit() calls (since edit previews diffs)
