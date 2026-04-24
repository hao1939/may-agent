# H-192 Preliminary Analysis: Cooperation Rate by Agent

**Date**: 2026-07-29
**Status**: Phase 0 — baseline measurement (observational)

## Data Source
- may.db: sessions, requests, evaluations tables
- Cooperation metric: outbound requests (fork + notify + message) per session

## Results

| Agent | Avg Quality | Sessions | Outbound Requests | Coop Rate |
|-------|------------|----------|-------------------|-----------|
| tech-lead | 0.78 | 3363 | 42 | 0.012 |
| scout | 0.76 | 1703 | 111 | 0.065 |
| optimizer | 0.76 | 2810 | 78 | 0.028 |
| bob | 0.73 | 3995 | 134 | 0.034 |
| coach | 0.73 | 3983 | 184 | 0.046 |
| may | 0.72 | 5224 | 289 | 0.055 |
| coder | 0.69 | 443 | 0 | 0.000 |

## Observations

1. **Coder has 0 cooperation AND lowest quality** — supports H-192 directionally
2. **Scout has highest coop rate AND high quality** — also directional support
3. **Tech-lead: low coop rate but highest quality** — counter-example (or: tech-lead's role is more receiving/reviewing than sending)
4. **May: high coop rate but lower quality** — may's role is dispatching (cooperation IS the task), so rate should be higher

## Confounds
- **Role differences**: some agents (may, coach) cooperate BY DESIGN — their task IS coordination
- **Quality metric**: evaluator quality may not capture system-level impact
- **Aggregation**: per-agent averages hide session-level variation
- **N**: coder has only 443 sessions — smallest sample

## Assessment

**Weak directional support** (coder = 0 coop, lowest quality; scout = highest coop, high quality) but **too confounded** by role design to conclude. The proper test needs **within-agent** comparison: do high-cooperation sessions from the SAME agent produce better downstream impact?

## Next Steps
- Phase 1 would need session-level analysis: for each session, count outbound requests AND quality score, then correlate within-agent
- But this requires may.db schema to link sessions→requests→evaluations cleanly
- Lower priority than gym-blocked experiments. Park until H-192 becomes testable.

## Decision
**H-192 remains P=0.50** — insufficient data to update prior. The observational data is suggestive but heavily confounded. Keep hypothesis active; revisit when we can do within-agent session-level analysis.
