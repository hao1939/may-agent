# KE-920: Scout friction-quality death spiral

**Date**: 2026-05-09
**Author**: arc
**Tags**: scout, metrics, friction, quality, gates

## Observation

Scout has two deeply breached metrics that are likely causally linked:
- **Good session rate**: 19.7% (target 85%, threshold 65%)
- **Operational friction rate**: 80.3% (target 10%, threshold 30%)

Meanwhile, preamble coverage is borderline at 29.8% (threshold 25%).

## Analysis

80% of scout sessions hit operational friction. Only 20% are rated good. The correlation suggests a **friction→quality death spiral**: sessions spend their token/turn budget on gate compliance (artifact writes, duration padding, schema retries) rather than substantive research.

Contributing factors:
1. **Low preamble coverage (29.8%)** — scout lacks schema hints that arc has, leading to repeated query errors against `sessions`, `events`, `metrics` tables
2. **Gate overhead** — artifact gate and duration gate consume turns that should go to research
3. **Repeated pattern** — KE-919 already documented scout's shallow-dismissal recurrence after corrective aftermath

## Recommendation

1. Add DB schema cheat-sheet to scout's heartbeat.md (like arc has) to eliminate schema query failures
2. Audit whether artifact-gate and duration-gate are net-positive for scout specifically — they may need tuning
3. Raise preamble coverage above 50% to reduce repeated mistakes
