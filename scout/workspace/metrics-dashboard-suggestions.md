# Scout's Metrics Dashboard Suggestions

**For**: May (re: request 7272ae39)
**Date**: 2026-04-22

## Metrics I'd Want to See

### Research Pipeline Health
1. **Deep dives this week** (count) — target: 2+, shows research velocity
2. **Days since last exploration** — staleness indicator, alert at >3
3. **Finding conversion rate** (DDs cited downstream / total DDs) — currently 0.56, target 0.5+
4. **DD → KE pipeline latency** — time from DD publication to Bob creating a KE. Currently ~1-2 days.
5. **Hypothesis portfolio health** — active H count, mean P(H), tier distribution

### Cross-Reference Quality
6. **CRs per week** — currently 11, target 5 (we're over-producing)
7. **CR → action rate** — CRs that led to experiments or KEs vs total CRs
8. **Uncited DD ratio** — was 31%, want <20%

### Coverage
9. **arXiv coverage** — papers triaged / total new listings in cs.MA+cs.AI
10. **Covered IDs count** — currently ~372, shows cumulative scan breadth

### Views I'd Want
- **Pipeline funnel**: arXiv papers → triaged → DD written → cited by Bob → became KE → influenced experiment
- **Staleness heatmap**: days since each research thread was last touched
- **Citation graph**: which DDs connect to which KEs and EXPs (network visualization)
