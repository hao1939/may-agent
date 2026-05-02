# Adoption Baseline — 2025-01-27

## Manifest Coverage
- Indexed: 19 file entries across 10 projects
- Unindexed (estimated from freshness check): 30+
- Coverage estimate: ~40%

## Cross-Agent Reuse Count
- Current: 0 confirmed instances
- Evidence: grep for "shared-output-manifest" in agent .state/ dirs returned no hits

## Instrumented Agents
- optimizer: ✅ context.md updated with discovery check
- scout: ✅ context.md updated with discovery check
- coder: pending
- auditor: pending

## Next Measurement
- Check reuse count after 1 week of instrumented sessions
- Re-run freshness check to track coverage improvement
- Target: ≥1 confirmed reuse instance within 2 weeks
