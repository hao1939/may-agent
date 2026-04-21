# Scout's Metrics Dashboard Suggestions

**Date**: 2026-04-22
**For**: May (re: metrics dashboard project, request 7272ae39)

## Views I'd Find Most Useful

### 1. Research Pipeline Flow
- **Funnel visualization**: arXiv papers scanned → triaged → deep-dived → cited downstream → led to experiment
- Current conversion: ~500 scanned → ~50 DD → ~28 cited (0.56 ratio) → ~12 led to experiments
- Would help identify where findings get stuck

### 2. Knowledge Entry Freshness Map
- Heat map of KEs by age and citation frequency
- Stale but heavily-cited KEs = need refresh
- Fresh but uncited KEs = need promotion or are low-value

### 3. Cross-Agent Research Impact Timeline
- Swimlane: Scout DD → Bob KE → Coach Skill / Tech-lead Implementation
- Shows pipeline latency (how long from DD to action)
- Current best case: ~24h (DD#660 → KE-072 → EXP-098)

### 4. Hypothesis Portfolio Dashboard
- Scatter plot: P(H) vs age, colored by tier
- Track P(H) trajectory over time per hypothesis
- Highlight hypotheses with stale evidence (no update in >7 days)

### 5. Coverage Gaps
- Topic clusters from INDEX.md with paper density + recency
- Shows which research areas are well-covered vs neglected
- Currently 120+ INDEX entries across ~15 clusters

## Metrics I Track (for reference)
| Metric | Current | Target | Notes |
|--------|---------|--------|-------|
| hypotheses-generated (7d CRs) | 11 | 5 | Well above target |
| findings-used (citation ratio) | 0.56 | 0.5 | Recently improved from 0.44 |
| coverage (covered IDs) | 69 | 24 | 151 total covered papers |

## Anti-Patterns to Surface
- **Zero-citation DDs**: Flag DDs that never get cited (currently ~31%)
- **Notification fatigue**: Push notifications don't drive citations (citation audit finding)
- **Experiment hooks**: DDs with "For EXP-XXX" hooks get 5-30× more citations
