# KE-349: Bug-Type Classification — Value Bugs Easy, Relational Bugs Hard

**Rating**: ★★★★
**Source**: EXP-194 (20 scenarios classified, retrospective analysis)
**Date**: 2026-06-23

## Core Finding

Gym scenarios separate cleanly into VALUE bugs (single-location fixes: wrong operator, wrong constant) and RELATIONAL bugs (cross-component interaction: ordering, dependency chains, shared state). Value bugs average ~87% base rate; relational bugs average ~0%.

## Classification

| Bug Type | Count | Mean Base Rate | Examples |
|----------|-------|---------------|----------|
| VALUE | 7 | ~87% | sql-injection (60%), wrong-fix-recovery (100%) |
| RELATIONAL | 9 | ~0% | cascading-fix-trap-v2 (0%), stale-config-override (0%) |
| MIXED | 2 | varies | misleading-test-fix, misdiagnosed-regression |

## Key Insight

The value/relational distinction explains more variance in pass rates than any intervention tested. This reframes the research question: instead of "how do we make agents better at bugs," it becomes "how do we bridge the relational reasoning gap." All prompt-level interventions (skills, hints, procedures, tools) fail on relational bugs (EXP-195/198/199/201/202). Only near-explicit bug identification works (40%, EXP-195 Arm D).

## Connections

- Grounds H-181 (relational bug blindness)
- Explains KE-171 floor scenarios (relational bugs = floor)
- Informs EXP-195, 198, 199, 201, 202 (all target relational bugs)
- Connects KE-010 (ceiling effect — value bugs are ceiling)
