# EXP-164 Results: Information Provision vs No Intervention

**Date**: 2026-04-22 (data collected 2026-04-15)
**Status**: CONCLUDED — Skill validated, ready for promotion

## Hypothesis

Providing a pre-written expert diagnosis (DIAGNOSIS.md) to the coder before a misleading-test-fix task will improve judgment accuracy, without requiring forced production gates or workflow changes.

## Design

| Arm | Label | Intervention | Runs |
|-----|-------|-------------|------|
| C | F1-only | Expert DIAGNOSIS.md provided in environment | 10 |
| D | Baseline | No intervention (clean scenario) | 8 |

Both arms use the same underlying `misleading-test-fix` scenario (invoice discount bug where the test assertion is wrong, not the production code).

## Results

| Arm | Pass Rate | Checks Passed | Product | Behavior |
|-----|-----------|---------------|---------|----------|
| C (F1-only) | **100%** (10/10) | 8/8 every run | 4/4 | 4/4 |
| D (Baseline) | **0%** (0/8) | 5/8 every run | 4/4 | 1/4 |

### Key Finding

The baseline coder consistently passes all product checks (tests pass) but fails 3/4 behavior checks: `discount-correct`, `test-assertion-fixed`, `applyDiscount-not-modified`. This means the coder fixes the wrong thing — it modifies production code to match the incorrect test, rather than fixing the test assertion.

With the expert diagnosis provided, the coder correctly identifies that the test is wrong (not the production code) and fixes the test assertion instead. **100% success across 10 runs.**

### Timing

F1-only runs: 37.9s – 103.4s (median ~48s)
Clean behavioral improvement with no meaningful latency penalty.

## Conclusion

**Information provision alone is sufficient to fix this class of judgment error.** No workflow gates, forced production, or extra steps needed. When the coder has access to a correct diagnosis, it follows it reliably.

### Implications for Training

1. **Diagnosis-first skills** are high-leverage: giving agents the right mental model before acting is more effective than constraining their process.
2. **Root-cause misidentification** is the coder's primary failure mode in ambiguous scenarios — not execution quality.
3. This pattern likely generalizes: for tasks where the agent consistently makes the wrong diagnosis, providing diagnostic heuristics (as context or skill) could improve accuracy without workflow overhead.

## Promotion Decision

**PROMOTE** the insight as a skill principle:
- For ambiguous debugging tasks, front-load diagnosis context
- Add to coder's skills: "When test and code disagree, verify which is correct before editing either"

## Raw Data Source

`agents/gym/results.jsonl` — entries with `experiment: "EXP-164"`
