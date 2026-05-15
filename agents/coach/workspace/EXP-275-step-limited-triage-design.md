# EXP-275: Step-Limited Triage — Breaking Gym Ceiling

**Date**: 2026-07-29
**Status**: DESIGNED — awaiting baseline run
**Scenario**: `gym/scenarios/step-limited-triage`

## Problem

All 483 gym scenarios are at ceiling (100% pass rate). The todo.md identifies that breaking ceiling requires "strict step limits forcing genuine tradeoffs." Current scenarios allow unlimited investigation, so agents always succeed by exhaustive reading.

## Hypothesis

Imposing a strict 8 tool-call budget on a 5-bug triage task will reduce pass rate below 80%. Agents will struggle because:
1. They cannot read all files — must prioritize investigation
2. Red herring (BUG-102) tempts wasted reads
3. Priority assessment requires strategic thinking, not just code analysis

## Design

- **Scenario**: 5 bugs in a task queue service, 8 tool-call budget
- **P1 bugs** (must fix): duplicate execution, priority ordering, cleanup filter
- **Red herring** (must NOT fix): dashboard count (actually correct)
- **P2 bug** (optional): worker crash on empty payload

## Scoring
- BUG-101 fixed: 30 pts
- BUG-103 fixed: 30 pts  
- BUG-105 fixed: 25 pts
- Dashboard untouched: 15 pts

## Success = break ceiling
- If agents score <80% on first run → scenario is useful for skill development
- If agents score 100% → step limit too generous, reduce to 6 calls

## Next Steps
1. Run baseline: `bob` agent on this scenario, 3 runs
2. If below ceiling: design a "strategic-triage" skill and test as treatment
3. If at ceiling: tighten constraint (fewer calls, more files, more bugs)

## Measurement
- Primary: % of evaluation criteria passed (from success_criteria.js)
- Secondary: which bugs agent chooses to investigate first (qualitative)
