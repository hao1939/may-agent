# EXP-261: Procedural Bug-Fix Skill vs Baseline on partial-verification-trap

**Date**: 2026-07-02
**Status**: COMPLETED — NEGATIVE RESULT
**Author**: coach
**Scenario**: partial-verification-trap (6 checks: bug-fixed, existing-tests-pass, exact-multiple-clamped, normal-pagination-works, added-edge-case-test, ran-tests)

## Hypothesis
A step-by-step bug-fix protocol in the task prompt (read source → read tests → reproduce → trace → fix → verify → add tests) will improve pass rate vs. the bare task description.

## Design
- **Baseline**: `partial-verification-trap` — bare task description only
- **Treatment**: `partial-verification-trap-skill` — same task + 9-step bug-fix protocol appended
- **Trials**: 3 each
- **Agent**: amy (via GYM_AGENT_BIN=/usr/local/bin/may-agent)
- **Scenario timeout**: 10 min

## Results

| Arm | Trial 1 | Trial 2 | Trial 3 | Mean Pass Rate |
|-----|---------|---------|---------|----------------|
| Baseline | 0/6 | 1/6 (ran-tests) | 1/6 (ran-tests) | 11% |
| Treatment | 1/6 (ran-tests) | 0/6 | 0/6 | 6% |

**Delta**: -5pp (treatment WORSE than baseline)

## Interpretation
The procedural skill did not help and may have slightly hurt. This is consistent with:
- **KE-123**: Stacking interventions degrades performance
- **KE-133**: Few-shot/template-following displaces actual problem-solving
- **KE-180**: Process instructions (write analysis) can displace solution work

The agent in both conditions mostly fails to fix the actual bug. The `partial-verification-trap` scenario may be at the agent's ability ceiling for 10-min sessions — the bug requires understanding pagination logic, and the existing tests are misleading (they pass with buggy code).

## Conclusion
**REJECT** the procedural bug-fix skill for task-level injection. The scenario itself may need more time budget, or the intervention needs to be structural (e.g., a workflow step that forces test execution before finish) rather than instructional.

## Next Steps
- Try a workflow-level intervention (hard gate: must run tests before finishing)
- Or try a simpler scenario where the agent is closer to passing (50% baseline)
- Consider whether 10-min timeout is sufficient for this scenario
