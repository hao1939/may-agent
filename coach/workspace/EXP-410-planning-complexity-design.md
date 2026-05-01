# EXP-410: Planning Under Complexity — Goldilocks Scenario Design

## Problem
EXP-400 and EXP-405 both INCONCLUSIVE because no scenario exists in the goldilocks zone:
- `partial-verification-trap`: at floor (1/6) — failures from coding inability, not planning
- `heartbeat-pressure`: at ceiling (6/7) — agents handle 7 items without needing explicit planning

We need a scenario where:
1. Baseline pass rate is 40-60% (goldilocks)
2. Failures are caused by **planning errors** (missed items, wrong order, dependency violations)
3. The decompose-before-acting skill should measurably help

## Hypothesis
A 12-item task with 3 dependency chains will produce baseline ≤60% pass rate.
The `decompose-before-acting` skill will raise pass rate by ≥20pp.

## Scenario Design: `planning-dependency-chain`

### Task Structure (12 items, 3 chains)
**Chain A (config → build → deploy):**
1. Read `config.json` and fix the missing `port` field (must be 3000)
2. Update `build.sh` to use the port from config.json (depends on #1)
3. Write deployment manifest `deploy.yaml` referencing build output (depends on #2)
4. Add health-check endpoint path to `deploy.yaml` (depends on #3)

**Chain B (data → transform → validate):**
5. Fix the CSV parser in `parse.js` (off-by-one on header row)
6. Create `transform.js` that imports from parse.js and adds timestamps (depends on #5)
7. Write validation schema `schema.json` for transformed output (depends on #6)
8. Add test case in `test.js` that imports transform and validates against schema (depends on #7)

**Chain C (docs → review → publish):**
9. Read `CHANGELOG.md` and add entry for version 2.1.0 summarizing changes from chains A and B (depends on #4, #8)
10. Update `README.md` install instructions to reference new port (depends on #1)
11. Create `MIGRATION.md` documenting breaking changes (depends on #9)
12. Write `release-notes.md` with user-facing summary (depends on #11)

### Why This Should Hit Goldilocks
- 12 items is 70% more than heartbeat-pressure (7 items)
- 3 dependency chains mean wrong ordering causes cascading failures
- Chain C depends on both A and B being complete — forces planning
- Items 9-12 require information from earlier items — can't do in isolation

### Success Criteria (12 checks)
Each item gets 1 check. Pass threshold: ≥9/12 (75%).
- Files must exist with correct content
- Dependency-respecting content (e.g., deploy.yaml must reference actual port from config.json)
- Cross-chain references must be correct (CHANGELOG must mention actual changes made)

### Scoring
- ≥9/12 checks = PASS
- <9/12 = FAIL

### Arms
- **Baseline**: Standard agent, no planning skill
- **Treatment**: Agent with `decompose-before-acting` skill loaded

### Protocol
- 3 trials per arm (6 total)
- Target: Baseline ≤60% pass rate, Treatment ≥80%
- If baseline >70%, scenario needs more items/dependencies (scale up)
- If baseline <30%, scenario too hard (simplify chain C)

## Skill Under Test
`agents/skills/decompose-before-acting.md` — instructs agent to:
1. List all items before starting
2. Identify dependencies
3. Plan execution order
4. Track progress against plan

## Next Steps
1. Build scenario files (task.md, scenario.json, success_criteria.js, environment/)
2. Run 3 baseline trials
3. If in goldilocks (30-70%), run 3 treatment trials
4. Write up results

## Created
2027-09-14
