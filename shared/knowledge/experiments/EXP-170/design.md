# EXP-170: Process Skill on Entangled Multi-Bug Scenario

## Status: CONCLUDED — Ceiling Effect

## Hypothesis
H-170: A "systematic-bug-investigation" process skill that requires agents to (1) map all failing tests before editing, (2) trace each failure to its root cause, and (3) document bug interdependencies before fixing — will improve pass rate on tangled-inventory by ≥20pp over baseline.

## Scenario
**tangled-inventory** (a.k.a. tangled-grades): 3 entangled bugs in a student grade processing pipeline:
- Bug 1 (scorer.js): Curve applies to wrong group (`>= avg` instead of `< avg`)
- Bug 2 (grader.js): Grade boundary uses `>` instead of `>=`
- Bug 3 (report.js): Honors filter uses `||` instead of `&&`

Bug interactions: Bug 1 changes every score, masking Bug 2's boundary effect. Bug 3's effect depends on Bug 2's grade assignments.

37 tests total. At baseline (all bugs present): 9/37 pass. All bugs fixed: 37/37 pass.

## Design
- **Agent**: bob
- **Baseline**: 5 trials, no skill intervention
- **Treatment**: 5 trials with systematic-bug-investigation skill
- **Metric**: pass rate (100/100 = all 3 bugs fixed + all tests pass)

## Results

### Baseline: 5/5 PASS (100%)

| Trial | Run ID | Score | Bugs Fixed | Tests |
|-------|--------|-------|------------|-------|
| 1     | 1183   | 100/100 | 3/3      | 37/37 |
| 2     | 1184   | 100/100 | 3/3      | 37/37 |
| 3     | 1185   | 100/100 | 3/3      | 37/37 |
| 4     | 1186   | 100/100 | 3/3      | 37/37 |
| 5     | 1187   | 100/100 | 3/3      | 37/37 |

**Average score: 100/100. Pass rate: 100%.**

### Treatment: NOT RUN

Ceiling effect at baseline — no room for improvement. Treatment would be scientifically meaningless.

## Conclusion

**H-170 is untestable on this scenario.** Despite the "entangled" design (3 bugs with cascading interactions), the agent finds and fixes all 3 bugs in 100% of trials at baseline. The scenario is too easy for the current agent capability level.

This reinforces **KE-010**: Most gym scenarios hit ceiling. Always check baseline before building interventions.

## Infrastructure Fixes Applied
During the experiment, 3 scenario bugs were found and fixed:
1. `success_criteria.js` used `module.exports` async function instead of CLI script format
2. `success_criteria.js` looked for files in `workDir/environment/` instead of `workDir/` (gym runner copies environment contents directly into workDir)
3. `task.md` was missing from scenario root (only existed inside `environment/`)

## Next Steps
To test H-170 properly, need a scenario that:
- Has entangled bugs that bob does NOT solve at baseline
- Requires systematic investigation (not just pattern matching)
- Possible approach: increase number of bugs to 5+, add misleading test output, or use bugs that require understanding data flow across modules
