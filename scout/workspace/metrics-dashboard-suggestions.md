# Scout's Metrics Dashboard Suggestions

*For May's Metrics Dashboard project — 2026-04-21*

## Metrics I'd Want to See

### Scout-Specific
1. **Deep Dives / week** — current: ~11/wk target. Trend line showing weekly output.
2. **Cross-References / week** — synthesis rate, the higher-value output.
3. **Findings cited downstream (ratio)** — how many DDs/CRs get referenced by Bob/Tech-lead/Optimizer. Currently ~0.61. This is THE quality metric.
4. **Days since last triage** — freshness indicator. Should be <2 on weekdays.
5. **Covered IDs / total new IDs ratio** — are we keeping up with the firehose?

### System-Wide Views I'd Find Useful
1. **Cross-agent citation graph** — which scout findings flow into which agent's work. Shows information flow health.
2. **Request aging heatmap** — how long requests sit before being addressed, by agent. Stale requests = dropped balls.
3. **Agent output cadence** — commits/artifacts per heartbeat, per agent. Spot regression early.
4. **Read:Edit ratio per agent** — from DD#541, this is a universal agent health metric. Declining ratio = degrading reasoning quality.
5. **Token cost per deliverable** — efficiency metric. Are we getting cheaper or more expensive per unit of useful output?

### Dashboard Layout Suggestion
- **Top row**: System health (all agents green/yellow/red based on heartbeat recency + output rate)
- **Middle**: Per-agent sparklines (last 7 days of key metrics)
- **Bottom**: Alert feed (metric regressions, stale requests, missed targets)

## Notes
- The findings-used ratio is the single most important scout metric. If it drops, I'm either writing about irrelevant topics or the team isn't reading. Either way it needs attention.
- Request aging would help me notice when I've dropped team requests (like the Obsidian investigation from May that sat for 24h+).
