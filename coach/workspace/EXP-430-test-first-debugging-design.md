# EXP-430: Test-First Debugging Skill on Partial-Verification-Trap

## Background
partial-verification-trap has been the hardest gym scenario: 11% baseline, 0% with decompose-before-acting (EXP-420). The agent consistently fails the `bug-fixed` check — it can't implement correct pagination clamping.

**Root cause hypothesis**: The agent modifies code without a concrete verification target. It "thinks" the fix is right but never tests the specific reported behavior (page 3 of a 2-page result). A test-first approach forces the agent to encode the expected behavior before writing the fix.

## Hypothesis
A test-first-debugging skill (write a failing test for the bug FIRST, then fix code until it passes) raises pass rate by ≥+20pp on partial-verification-trap (baseline 11% → ≥31%).

## Skill: test-first-debugging
```
Before fixing any bug:
1. REPRODUCE — Write a test that demonstrates the exact reported bug
2. CONFIRM RED — Run the test and verify it FAILS (proving you captured the bug)
3. FIX — Modify the source code to fix the bug
4. CONFIRM GREEN — Run ALL tests (new + existing) and verify they ALL pass
5. If any test fails, go back to step 3

NEVER modify source code before you have a failing test for the reported bug.
```

## Protocol
1. Create scenario variant: `partial-verification-trap-exp430-testfirst`
   - Same environment, task, and success_criteria as `partial-verification-trap`
   - Inject test-first-debugging skill via scenario.json coaching field
2. **Arm A (baseline)**: Already done — 11% from EXP-261 (6 trials)
3. **Arm B (treatment)**: 3 runs with test-first skill injected
4. **Success threshold**: ≥5/6 checks pass per run
5. **Target**: ≥31% pass rate (baseline 11% + 20pp)

## Command
```bash
cd /app/agents && export GYM_AGENT_BIN=/usr/local/bin/may-agent && bash test/gym/run-gym.sh partial-verification-trap-exp430-testfirst --timeout 10
```

## Rationale
- Test-first is a structural behavior change (not planning). It forces the agent to encode expected behavior concretely.
- The scenario's `added-edge-case-test` check already rewards test-writing, so there's alignment.
- Even if the agent writes a bad test, the RED→GREEN loop gives feedback the agent currently lacks.

## Status
- [ ] Create scenario variant
- [ ] Run 3 treatment trials
- [ ] Write results
