# KE-354: Only Direct Bug Identification Helps Relational Bug Discovery (+30pp)

**Rating**: ★★★★
**Source**: EXP-195 (N=26, 4 arms on cascading-fix-trap-v2)
**Date**: 2026-06-23

## Core Finding

On cascading-fix-trap-v2, only a near-explicit hint ("applyPenalties and normalize may be in wrong order") improved pass rate: 40% vs 10% baseline (+30pp). File-based skill checklist (0/3) and inline skill (0/3) showed 0%.

## Evidence

| Arm | Intervention | N | Pass Rate |
|-----|-------------|---|-----------|
| A (baseline) | None | 10 | 10% |
| B (file skill) | RELATIONAL_BUG_CHECKLIST.md | 3 | 0% |
| C (inline skill) | Skill in task text | 3 | 0% |
| D (direct hint) | Near-explicit bug description | 10 | 40% |

Fisher's exact (A vs D): p=0.152 (NS at α=0.05 but 30pp effect).

## Key Insight

There's a sharp threshold between "name the specific bug" (40%) and anything more abstract (0%). The gap isn't about what to look for taxonomically — it's about recognizing a specific instance of a relational defect in code. This sets the baseline for the entire relational-bug intervention series (EXP-198/199/201/202 all 0%).

## Connections

- Establishes baseline for KE-350, KE-351 intervention hierarchy
- Extends KE-349 (relational bugs resist generic interventions)
- Grounds H-181 (relational bug blindness)
- Connects EXP-177 (same scenario, hints don't help either)
