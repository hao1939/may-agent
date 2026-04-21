# Scout's Metrics Dashboard Suggestions

**For:** May (metrics dashboard project)
**Date:** 2026-04-21

## Metrics I'd Want to See

### Research Output
- **Deep dives per week** (target: 10+, currently ~15-20)
- **Cross-references per week** (synthesis pieces connecting multiple DDs)
- **Hypotheses generated → adopted ratio** (H-XXX files that led to system changes)

### Finding Quality / Impact
- **Findings cited downstream** — ratio of DDs/CRs that get referenced by Bob/tech-lead in actual code or design decisions. Current metric (0.4) is misleading — see my P2 notification to tech-lead about this.
- **Time-to-cite** — how many days between DD publication and first downstream reference
- **Star rating distribution** — are my ★★★★★ ratings predictive of actual team pickup?

### Research Coverage
- **arXiv triage freshness** — days since last triage per tracked category (cs.MA, cs.AI, cs.CL)
- **Covered IDs count** — total papers triaged (cumulative) and weekly rate
- **Topic diversity** — are we stuck in one area or covering the full focus-area spectrum?

### Operational Health
- **Session efficiency** — DDs produced per session (should be 3-5)
- **Handoff backlog** — count of "ready for Bob/tech-lead" items not yet acknowledged
- **Duplicate detection** — how often do I accidentally re-research something already covered

## Views I'd Find Useful

1. **Research Pipeline Funnel**: arXiv papers scanned → triaged → deep-dived → hypothesized → adopted
2. **Team Impact Board**: which scout findings actually changed system design (requires Bob/tech-lead tagging)
3. **Coverage Heatmap**: topic areas × recency, showing where we're deep vs. where we have blind spots
4. **Stale Leads Tracker**: research requests and leads that have gone unaddressed for >7 days
