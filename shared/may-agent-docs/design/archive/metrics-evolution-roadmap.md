# Metric System — Evolution Roadmap

**Author:** Hao  
**Date:** 2026-04-15  
**Status:** Vision document (not for implementation now)  
**Related:** [Phase 1 Design](metrics-system.md) | [Project File](../../may/workspace/projects/metric-system.md)

---

## Context

Phase 1 is approved and starting. This is the long-term vision for where the metric system goes. Not for implementation now — for the team to keep in mind as they build.

## The Levels

### Level 1: Metrics as Signals (Phase 1 — NOW)
Metrics measure and display. Agents query them in heartbeats, apply judgment, decide what to do. May oversees the dashboard. Human approves P0/P1.

**Success looks like:** Every agent checks their metrics every heartbeat. May spots stalled/regressing metrics and nudges owners. The dashboard replaces scattered todo lists.

### Level 2: Metrics Trigger Work
When a health metric breaches threshold, May automatically dispatches a fix — not just notices it. When a continuous metric stalls for 48h, the owner gets a persistent-task iteration forked for them. The metric system becomes the dispatcher, not just the dashboard.

**Example:** `health.error-rate` crosses 5% → May auto-forks tech-lead to investigate, without waiting for her next heartbeat to notice.

### Level 3: Agents Set Their Own Metrics
Right now May/Hao create metrics. At Level 3, an agent that discovers a gap proposes a metric, gets it approved, and starts driving it — all self-directed. Agents identify what the system needs, not just respond to what they're told.

**Example:** Scout notices hypothesis pickup rate is low → proposes `research.hypothesis-pickup-rate` metric → May approves → Scout starts tracking and optimizing for it.

### Level 4: Metrics Evolve the System
Cross-metric correlations emerge from the data. "When research throughput drops, coder quality drops 2 weeks later." The system learns leading indicators and adjusts priorities. May shifts from manually overseeing to managing exceptions.

**Example:** The system notices `efficiency.ops-per-session` predicts `cost.daily` with 24h lag, and `gym.pass-rate` predicts `quality.coder` with 2-week lag. May uses these relationships to catch problems before they hit.

## The Real Next Level

The biggest unlock isn't automation — it's **consistent adoption**. Level 1 done well would already be transformative. Every agent checking metrics, every owner pushing their numbers, May reviewing the full picture — that's the foundation everything else builds on.

Once 5+ agents are reliably using metrics for 2+ weeks, the patterns for Level 2 will be obvious from the data. Don't skip ahead.

## For the Team (Build Principles)

Keep this in mind as you build Phase 1:
- Design the schema so it can support Level 2 triggers later (the `metric_alerts` table is the hook)
- Make metric queries fast and easy — if it's friction, agents won't use it
- Record good snapshot notes — Level 4 needs historical context to find correlations
- **Focus on adoption first, features later**

## Progression Criteria

| Level | Prerequisite | Signal to Advance |
|-------|-------------|-------------------|
| 1 → 2 | 5+ agents using metrics for 2+ weeks | Patterns for auto-dispatch are obvious from data |
| 2 → 3 | Auto-dispatch running reliably for 1+ month | Agents have demonstrated they understand what metrics matter |
| 3 → 4 | 20+ metrics with 1+ month of dense snapshot history | Enough data for meaningful correlation analysis |
