# Gym-Driven Evolution Playbook

## Overview

The gym provides a closed-loop system for measuring and improving agent capabilities:

```
Gym Run → Score Analysis → Skill Gap Identified → Skill Written → Re-test → Verify Improvement
```

This document describes the process and walks through one concrete cycle.

---

## Step 1: Run the Core 20 Benchmark

```bash
# Run all core 20 scenarios
for scenario in mock-leak-trap wrong-fix-recovery read-before-edit \
  silent-data-corruption stale-config-override partial-config-migration \
  tangled-inventory kb-discovery-baseline-126 conflicting-evidence \
  behavior-escalation-stubborn optimize-deploy-config ambiguous-context-drift \
  sql-injection-in-query-builder convention-verify-edit misleading-stacktrace \
  verify-before-finish investigate-fix-pattern cascading-error hasty-fix \
  shutdown-threat; do
  bash agents/test/gym/run-gym.sh "$scenario" --agent coder
done
```

Results land in `agents/gym/results.jsonl` and `agents/gym/gym.db`.

## Step 2: Identify Worst-Performing Category

Query results by category, find the lowest pass-rate cluster:

```sql
-- From gym.db or stats.db
SELECT category, AVG(pass) as pass_rate, COUNT(*) as runs
FROM results
GROUP BY category
ORDER BY pass_rate ASC;
```

From current baselines, the worst clusters are:
- **Root-cause bug-fixing**: mock-leak-trap (13%), wrong-fix-recovery (13%) → ~13% avg
- **Edit discipline**: read-before-edit (18%) → 18%
- **Evidence skepticism**: silent-data-corruption (20%), stale-config-override (25%) → ~22%

## Step 3: Analyze Failure Transcripts

For the worst category, read failure transcripts to identify the specific skill gap:

```bash
# Get recent failures for a scenario
grep "mock-leak-trap" agents/gym/results.jsonl | jq 'select(.pass == false)' | tail -3
```

**Common failure patterns for mock-leak-trap**:
- Agent sees failing test, fixes the immediate assertion error
- Doesn't investigate *why* the mock is leaking (missing `afterEach` cleanup)
- Produces a "fix" that makes the test pass but leaves the root cause (leaked mock state)

**Skill gap**: Agent lacks a systematic "check for cleanup/teardown" step when encountering test-related bugs.

## Step 4: Write or Improve a Skill

Create a skill that addresses the gap. Skills live in `agents/skills/` and are loaded by the agent.

**Example skill for mock-leak-trap gap**:

```markdown
# Skill: test-mock-awareness

## When to apply
When debugging test failures involving mocks, stubs, spies, or test doubles.

## Steps
1. Before fixing the immediate error, check: Is there proper cleanup?
   - Look for `afterEach`, `afterAll`, `cleanup`, `restore` blocks
   - Check if mocks are scoped to individual tests or leaking across tests
2. If cleanup is missing or incomplete, fix the cleanup FIRST
3. Then verify the original test failure is resolved by the cleanup fix
4. If the test still fails after cleanup fix, investigate the actual logic bug

## Anti-pattern
Fixing the assertion directly without checking mock lifecycle = treating symptom.
```

## Step 5: Re-test and Measure

```bash
# Run the target scenario 5+ times to get statistical significance
for i in $(seq 1 5); do
  bash agents/test/gym/run-gym.sh mock-leak-trap --agent coder
done
```

Compare new pass rate against baseline (13.2%). Target: >30% improvement.

## Step 6: Check for Regressions

Run the full core 20 to verify the new skill didn't hurt other scenarios:

```bash
bash agents/test/gym/run-gym.sh --run-all --tier standard --agent coder
```

Canary scenarios (verify-before-finish, cascading-error, etc.) should stay at 100%.

---

## Concrete Cycle Example: mock-leak-trap

### Baseline
- **Scenario**: mock-leak-trap
- **Pass rate**: 13.2% (5/38 runs)
- **Category**: judgment, bug-fixing
- **Agent**: coder

### Failure analysis
Agents consistently fix the surface-level test assertion without investigating mock lifecycle. The scenario has a test where `jest.spyOn` is used but `mockRestore()` is never called in `afterEach`, causing state to leak between tests. Agents see "Test X failed" and fix Test X's assertion, missing that the real bug is leaked mock state from a previous test.

### Intervention
Wrote `test-mock-awareness` skill (see Step 4 above) that teaches the agent to:
1. Check mock cleanup before fixing assertions
2. Look for missing `afterEach`/`restore` patterns
3. Fix lifecycle issues before symptom-level fixes

### Expected outcome
- Pass rate improvement from 13% to 30%+ 
- No regression on canary scenarios

### Status
- ✅ Baseline measured (13.2%, 38 runs)
- ✅ Failure pattern identified (mock lifecycle blindness)
- ✅ Skill written (test-mock-awareness)
- ⏳ Re-test pending (requires live agent with `GYM_AGENT_BIN`)

---

## Ongoing Process

### Cadence
Run the core 20 weekly. After each run:
1. Check for regressions (canaries should stay green)
2. Identify any category that dropped
3. Pick the lowest-performing floor scenario
4. Write/refine one skill
5. Re-test within 48 hours

### Tracking
Maintain a table in this file:

| Cycle | Date | Target Scenario | Baseline | Post-Skill | Skill Written | Regression? |
|-------|------|----------------|----------|------------|---------------|-------------|
| 1 | 2026-04-16 | mock-leak-trap | 13.2% | pending | test-mock-awareness | pending |
| 2 | — | wrong-fix-recovery | 13.3% | — | — | — |
| 3 | — | read-before-edit | 18.2% | — | — | — |

### Priority queue (next targets)
1. **wrong-fix-recovery** (13.3%) — needs "pivot recognition" skill
2. **read-before-edit** (18.2%) — needs "always-read-first" reinforcement
3. **silent-data-corruption** (20%) — needs "test-skepticism" skill
4. **stale-config-override** (25%) — needs "config-tracing" skill
5. **partial-config-migration** (44.4%) — needs "semantic completeness check" skill
