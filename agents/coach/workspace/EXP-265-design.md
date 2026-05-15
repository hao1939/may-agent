# EXP-265: Compound Verification Skill

**Date**: 2026-07-09
**Status**: CLOSED — 0% both arms. See EXP-265-results.md.
**Problem**: partial-verification-trap scenario at 0% (5 runs). Agents fix the reported bug but break existing tests — they fail the "existing-tests-pass" check.
**Root cause hypothesis**: Agents jump to fixing without first establishing what must be preserved.

## Intervention Design

**Skill**: "preserve-before-fix" — injected as context for the treatment arm.

**Core behavior**: Before modifying any code, the agent must:
1. Run the existing test suite and note all passing tests
2. List invariants that must be preserved
3. After fixing, re-run the FULL test suite (not just the new test)

**Mechanism**: Step-start structural prompt (proven 84% effective per KE-SKILL-QUALITY-ANSWER)

## Arms

| Arm | Scenario | Skill | Runs |
|-----|----------|-------|------|
| A (baseline) | partial-verification-trap | none | 5 (have 4 already + 1 new = 5) |
| B (treatment) | partial-verification-trap-compound | preserve-before-fix | 5 |

## Treatment Scenario

Copy `partial-verification-trap` → `partial-verification-trap-compound`, inject skill into task.md:

```
IMPORTANT — Before changing any code:
1. Run the existing test suite first: `node test/paginate.test.js`
2. Note every test that passes — these MUST still pass after your fix
3. After making changes, re-run the FULL test suite to confirm nothing broke
4. Only then verify your fix addresses the reported bug
```

## Success Criteria
- Treatment ≥ 40% pass rate (vs 0% baseline)
- Primary metric: all 6 checks pass (especially "existing-tests-pass")

## Results (Jul 9)

| Arm | Runs | Passed | Rate |
|-----|------|--------|------|
| Baseline | 5 | 0 | 0% |
| Treatment (text prompt) | 2 | 0 | 0% (worse — even ran-tests check failed) |

**Finding**: Text intervention made things WORSE. Baseline at least passed `ran-tests` (1/6); treatment failed all 6/6.
**Confirms**: KE-338 (text coaching is dead). Adding instructional text before the task overloads context and degrades performance.
**Status**: NEGATIVE RESULT — closed.
**Next**: This scenario needs a structural intervention (e.g., workflow that forces test-run-first), not text coaching.

