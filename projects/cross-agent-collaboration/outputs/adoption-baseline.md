# Adoption Baseline — 2025-01-27

## Manifest Coverage
- Indexed in manifest: 44 entries
- Unindexed (freshness check): 140 files
- Coverage estimate: ~24%
- Note: Many unindexed files are in _archive/ and may be low-value

## Cross-Agent Reuse Count
- Current: 0 confirmed instances
- Evidence: No hits for "shared-output-manifest" in agent .state/ dirs

## Instrumented Agents
- optimizer: ✅ context.md has Pre-Work Discovery Check with correct path
- scout: ✅ context.md has Pre-Work Discovery Check with correct path
- coder: ❌ not yet instrumented

## Freshness Script
- Location: outputs/manifest-freshness-check.sh
- Last run: 140 unindexed files found
- High-value gaps: prompt-efficiency, handler-reliability, request-deduplication, agent-system-literacy outputs

## Next Measurement
- Check reuse count after 1 week of instrumented sessions
- Target: 5 instances/week of cross-agent output reuse
