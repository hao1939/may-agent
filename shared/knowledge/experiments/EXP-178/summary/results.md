# EXP-178: Difficulty-Adaptive Content-First Guard Pilot — Results

## Design
- **Arms:** G1 (no-guard baseline), G2 (production-mode uniform), G3 (passive-injection uniform), G4 (adaptive: G2 on medium, G3 on hard)
- **Scenarios:** sql-injection (medium), cascading-fix-trap (hard)
- **Trials:** 15 per cell, 120 total

## Results Summary

| Arm | Scenario | Pass Rate | Notes |
|-----|----------|-----------|-------|
| G1 (baseline) | sql-injection | 15/15 (100%) | Ceiling effect — too easy |
| G1 (baseline) | cascading | 0/15 (0%) | Floor effect — too hard |
| G2 (production-mode) | sql-injection | 15/15 (100%) | No improvement possible (ceiling) |
| G2 (production-mode) | cascading | 0/15 (0%) | Guard didn't help on hard scenario |
| G3 (passive-injection) | sql-injection | 15/15 (100%) | No improvement possible (ceiling) |
| G3 (passive-injection) | cascading | 0/15 (0%) | Guard didn't help on hard scenario |
| G4 (adaptive) | sql-injection | 15/15 (100%) | No improvement possible (ceiling) |
| G4 (adaptive) | cascading | 0/15 (0%) | Guard didn't help on hard scenario |

## Analysis

### Key Finding: No Treatment Effect Detected
All arms produced identical pass rates across both scenarios:
- **sql-injection**: 100% pass rate across all arms (ceiling effect)
- **cascading**: 0% pass rate across all arms (floor effect)

### Interpretation
1. **Ceiling effect on sql-injection:** The medium-difficulty scenario is solved reliably by the baseline agent. Guard interventions (G2-G4) cannot improve on 100%.
2. **Floor effect on cascading:** The hard scenario is never solved, regardless of guard type. The 8/9 check pass rate (consistent across all 60 cascading trials) suggests the agent gets close but systematically fails one specific check.
3. **No discriminating power:** These two scenarios lack the difficulty range needed to differentiate guard strategies. An ideal scenario would have baseline pass rates in the 30-70% range.

### Recommendations
1. **Find medium-difficulty scenarios** where baseline pass rate is 30-70% to test guard effectiveness
2. **Investigate the failing cascading check** — 8/9 checks pass consistently, so a targeted hint for the 9th check might show guard value
3. **Consider scenario variants** that adjust difficulty (e.g., cascading-v2 with fewer distractors, or sql-injection with additional constraints)

## Data
- Raw trial data: `agents/shared/knowledge/experiments/EXP-178/runs.jsonl` (120 entries)
- Arm configs: `EXP-178/arm-configs.json`
- Runner: `agents/gym/experiments/run-exp178.py`
