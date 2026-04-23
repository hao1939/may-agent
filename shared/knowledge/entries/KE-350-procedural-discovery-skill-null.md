# KE-350: Procedural Discovery Skills Don't Help Find Relational Bugs

**Rating**: ★★★★
**Source**: EXP-198 (N=30, 3 arms × 10 trials, all 0%)
**Date**: 2026-06-23

## Core Finding

Step-by-step procedural instructions ("swap adjacent pipeline steps, run tests, check improvement") had zero effect on relational bug discovery. All three arms (baseline, procedure, procedure + worked example) scored 0/10. H-198a FALSIFIED.

## Evidence

| Arm | Intervention | Pass Rate |
|-----|-------------|-----------|
| A (baseline) | None | 0/10 (0%) |
| B (procedural) | Step-by-step swap procedure | 0/10 (0%) |
| C (proc+example) | Procedure + worked example | 0/10 (0%) |

All 30 trials: pass 8/9 checks, fail exactly on `pipeline-order-fixed`.

## Key Insight

The bottleneck is NOT "agents don't know the method." Agents don't execute procedures faithfully — they read the instruction, acknowledge it, then continue with default pattern-matching. This validates H-181: relational bug blindness is a **capability gap**, not a knowledge gap (declarative or procedural).

## Intervention Hierarchy (cumulative)

| Intervention Type | Pass Rate | Source |
|-------------------|-----------|--------|
| Generic skill | 0% | EXP-195 |
| Procedural method | 0% | EXP-198 |
| Tool available | 0% | EXP-199 |
| Tool + instruction | 0% | EXP-199 |
| Meta-cognitive enumeration | 0% | EXP-202 |
| Verification remasking | 0% | EXP-201 |
| Direct hint (name the bug) | 40% | EXP-195 |

## Connections

- Extends KE-349 (relational bugs resist all interventions)
- Extends KE-002 (text rules don't fix judgment)
- Validates H-181 (capability gap, not knowledge gap)
- Connects EXP-195, EXP-199, EXP-201, EXP-202
