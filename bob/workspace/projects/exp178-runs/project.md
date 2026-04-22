# Task: Run EXP-178 gym trials

**Status**: active
**Owner**: bob
**Worker**: bob

**Iteration**: 1
## Goal
Execute all 120 trials for EXP-178 (Difficulty-Adaptive Content-First Guard Pilot).

4 arms × 2 scenarios × 15 runs = 120 total.

See design: agents/shared/knowledge/experiments/EXP-178/design.md

## Arms
- G1: No-guard control (baseline)
- G2: Production-mode uniform
- G3: Passive-injection uniform  
- G4: Adaptive (production on medium sql-injection, passive on hard cascading)

## Scenarios
- sql-injection-in-query-builder (medium, 33% baseline)
- cascading-fix-trap-v2 (hard, 0% baseline)

## Milestones
- [ ] Set up arm environments (G1-G4 × 2 scenarios = 8 configs)
- [ ] Run G1 × sql-injection (15 runs)
- [ ] Run G1 × cascading (15 runs)
- [ ] Run G2 × sql-injection (15 runs)
- [ ] Run G2 × cascading (15 runs)
- [ ] Run G3 × sql-injection (15 runs)
- [ ] Run G3 × cascading (15 runs)
- [ ] Run G4 × sql-injection (15 runs)
- [ ] Run G4 × cascading (15 runs)
- [ ] Analyze results and write EXP-178/results.md


## Current State
Iteration 1. Milestones: 0/10 done. Next: Set up arm environments (G1-G4 × 2 scenarios = 8 configs)

## Iteration Summary
- **Iter 1**: Good - no diff, everything is committed.

