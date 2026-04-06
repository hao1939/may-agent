# EXP-038: Adversarial QA Framing — Phase A Results

**Date**: 2026-04-06
**Author**: Tech-Lead
**Status**: PHASE A COMPLETE — ceiling effect, needs harder scenario
**Hypothesis**: H-001 (Adversarial QA framing → higher detection)

## Summary

**H-001 NOT SUPPORTED on this scenario.** Both standard and adversarial QA framings achieve identical 100% pass rates (7/7 checks) on the `qa-evidence-discipline` scenario. The adversarial framing adds ~58% latency overhead with no measurable benefit.

## Raw Results

### Standard QA (control): `qa-evidence-discipline`

| Run | Result | Duration | Checks |
|-----|--------|----------|--------|
| 1 | PASS | 80.2s | 7/7 |
| 2 | PASS | 72.3s | 7/7 |
| 3 | PASS | 78.6s | 7/7 |

**Pass rate: 3/3 (100%)** | **Mean duration: 77.0s** | **All 7 checks pass every run**

### Adversarial QA (treatment): `qa-evidence-adversarial`

| Run | Result | Duration | Checks |
|-----|--------|----------|--------|
| 1 | PASS | 132.3s | 7/7 |
| 2 | PASS | 123.3s | 7/7 |
| 3 | PASS | 112.4s | 7/7 |

**Pass rate: 3/3 (100%)** | **Mean duration: 122.7s** | **All 7 checks pass every run**

### Duration Comparison

| Condition | Mean Duration | Overhead |
|-----------|--------------|----------|
| Standard QA | 77.0s | baseline |
| Adversarial QA | 122.7s | **+58%** |

## Analysis

### Ceiling Effect

Both conditions achieve identical outcomes on all 7 success criteria checks:
1. ✅ Review file exists
2. ✅ Correct verdict (FAIL — bugs present)
3. ✅ Cites test output (evidence discipline)
4. ✅ Finds invalid tier bug (test-exposed)
5. ✅ Finds additional bug (NOT test-exposed — allowlist trim or cleanup interval)
6. ✅ Cites specific code references
7. ✅ No hallucinated findings

The scenario has 4 planted bugs of moderate difficulty. The coder agent's existing evidence discipline skills (structured plan, run tests, compare to spec) are sufficient to find them all under standard framing. Adversarial framing adds no detection benefit because the failure mode being tested (EVIDENCE_GAP — making claims without running verifications) doesn't occur with this agent.

### Why H-001 Isn't Supported (On This Scenario)

H-001 predicts adversarial framing increases issue detection from 14% to >30%. The historical 14% rate came from production QA reviews where:
- Code changes were real (not planted bugs)
- Time pressure was higher
- QA agent sometimes rubber-stamped without running tests

This scenario is too controlled:
- Bugs are deliberately planted and moderately obvious
- The task explicitly requires running tests and citing evidence
- The agent has been trained on evidence discipline skills
- There's no time pressure or competing demands

### What This Tells Us

1. **Adversarial framing is a "more expensive same result" in easy scenarios** — the agent spends more time being thorough but finds the same bugs
2. **The duration overhead is real** — ~58% more time for identical outcomes is significant
3. **To test H-001 properly, we need a harder scenario** where standard QA fails at least sometimes

### Needed: Harder Scenario for Phase A2

A proper test of H-001 requires:
- Bugs that are subtle enough to miss under standard review (not test-exposed, not spec-deviant)
- Security-class bugs (injection, TOCTOU, privilege escalation) that require adversarial thinking
- A baseline failure rate of 30-50% under standard QA (below ceiling, above floor)

## Implications

### For H-001

**Status**: Inconclusive — ceiling effect prevents evaluation. P(H) unchanged at 0.52.

The experiment is well-designed but the scenario is too easy. Need to either:
1. Create a harder scenario with subtler bugs (Phase A2)
2. Move to Phase B (production workflow) where real code changes provide natural difficulty variation

### For EXP-038 Next Steps

1. **Phase A2**: Create `qa-evidence-hard` scenario with:
   - Logic bugs that tests don't catch (e.g., race conditions, off-by-one in edge cases)
   - Security vulnerabilities (e.g., timing attack on rate limiter, IP spoofing bypass)
   - Spec deviations that require careful reading (e.g., "should" vs "must" differences)
2. **Phase B**: Use the adversarial workflow in production for 5 real code changes

## Files

- `agents/gym/scenarios/qa-evidence-adversarial/` — adversarial variant of qa-evidence-discipline
- `agents/gym/scenarios/qa-evidence-discipline/` — standard QA scenario
