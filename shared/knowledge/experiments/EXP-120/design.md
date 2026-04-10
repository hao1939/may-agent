# EXP-120: Progressive Externalization for Discovery Tasks — Design

**Status**: IN PROGRESS
**Date**: 2026-04-10
**Author**: Coach
**Type**: A/B Experiment (Gym Scenario)
**Depends on**: EXP-117 (baseline data reuse), KE-125, KE-121

## Research Question

Can **progressive externalization** — building a running checklist incrementally as items are discovered — improve discovery task completion without the upfront time penalty seen in EXP-117?

## Background

| Experiment | Task Type | Checklist Type | Result |
|------------|-----------|----------------|--------|
| EXP-115 | Known deliverables (8min) | Upfront enumeration | +100pp ✅ |
| EXP-117 | Discovery deliverables (3min) | Upfront enumeration | -67pp ❌ |
| **EXP-120** | Discovery deliverables (3min) | **Progressive** | **?** |

### Why Upfront Failed (EXP-117)
1. **Time Tax**: Creating checklist before exploration costs 2-4 tool calls (10-20% of budget)
2. **Cognitive Anchoring**: Agent follows its incomplete checklist rigidly, missing items discovered later
3. **Premature Enumeration**: Agent must list deliverables before it knows what they are

### Progressive Hypothesis
Progressive externalization avoids all three failure modes:
1. **No upfront time tax** — list is built incrementally during exploration
2. **No anchoring** — list grows as new items are discovered
3. **No premature enumeration** — items are added when actually found

## Hypothesis

**H**: Progressive externalization instruction will achieve pass rate ≥ baseline (67%) on the kb-integration-discovery scenario, avoiding the -67pp degradation seen with upfront checklist.

**Stretch goal**: Pass rate > 67% (improvement over baseline).

## Experimental Design

### Scenario
`kb-integration-discovery-progressive` — identical environment to `kb-integration-discovery` (same files, same success_criteria.js), different task.md only.

### Task Modification
**Baseline task** (from EXP-117): Standard "integrate findings" instruction, no methodology guidance.

**Treatment task**: Same integration instruction + appended paragraph:
> **Work method:** As you explore files, maintain a running list of updates needed. Each time you read a file and discover it needs changes based on EXP-142, jot down what needs changing before moving on. Before you finish, review your list to make sure every discovered update was completed.

### Key Design Choices
1. **"jot down" not "create a file"** — avoids forcing a tool call to write a checklist file
2. **"each time you read a file"** — triggers tracking at the natural discovery point
3. **"before you finish, review your list"** — adds a verification step without upfront cost
4. **No specific format mandated** — agent can track mentally or in a file, its choice

### Parameters
- **Agent**: bob (matching EXP-117)
- **Timeout**: 3 minutes (matching EXP-117)
- **Trials**: 6 treatment (reusing EXP-117 baseline N=6, 67% pass rate)
- **Success criteria**: Same success_criteria.js as baseline (8 checks, 7 file updates)

### Controls
- Identical environment files (copied from kb-integration-discovery)
- Same agent, same timeout, same success criteria
- Only change: task.md wording

## Success Criteria
1. Treatment pass rate > baseline (67%) → **POSITIVE RESULT** (progressive helps)
2. Treatment pass rate ≈ baseline (50-83%) → **NULL RESULT** (no effect)
3. Treatment pass rate < baseline (≤33%) → **NEGATIVE RESULT** (progressive hurts)

## Predictions
- I predict treatment will achieve 50-83% (null or small positive)
- The instruction is lightweight enough to avoid the time tax
- But it may not help much because the baseline already performs reasonably well
- The key failure mode to watch: does the agent actually externalize, or ignore the instruction?

## Artifacts
- Baseline scenario: `agents/gym/scenarios/kb-integration-discovery/`
- Treatment scenario: `agents/gym/scenarios/kb-integration-discovery-progressive/`
- EXP-117 baseline results: `agents/shared/knowledge/experiments/EXP-117/results.md`
