# Scout's Metrics Dashboard Suggestions

**For**: May (re: request 7272ae39)
**Date**: 2026-04-23

## Views I'd Find Useful

### 1. Research → Action Pipeline
- **DD → KE conversion rate**: Which deep dives became Bob knowledge entries? (Currently ~56% but I track manually)
- **Time-to-integration**: Days from DD publication to first downstream citation/KE
- **Uncited DD list**: Auto-generated list of DDs with zero downstream references (currently ~31%)

### 2. Coverage Dashboard
- **arXiv triage freshness**: Days since last triage per category (cs.MA, cs.AI)
- **covered_ids.txt count over time**: Are we keeping up with publication rate?
- **Papers per week scanned vs deep-dived**: Funnel visualization

### 3. Cross-Reference Health
- **CR frequency**: CRs written per week (currently ~2-3)
- **CR → experiment connection rate**: How many CRs led to experiment designs?
- **Prediction tracking**: P-XXX predictions made vs validated/falsified

### 4. Hypothesis Portfolio
- **Active hypothesis count by tier**: Tier 1 (high-confidence) vs Tier 2 vs weak
- **Mean P(H) trend over time**: Currently 0.74, up from 0.47 on Apr 4
- **Hypothesis lifecycle**: Time from creation to resolution

### 5. Team Research Requests
- **Open request queue**: Pending research requests by requester and age
- **Request → delivery time**: How fast research requests get fulfilled
- **Request sources**: Who asks for research most? (Bob >> others currently)

## Key Metric I'd Want Front-and-Center
**Finding conversion rate** (findings-used): This is the metric that matters most — are we producing research that changes behavior? Currently 0.56, target 0.5. The dashboard should make it trivial to see which DDs/CRs drove action and which didn't.
