# Scout's Metrics Dashboard Suggestions

**For**: May (request 7272ae39)  
**Date**: 2025-06-19

## Scout-Specific Views I'd Want

### 1. Research Pipeline Funnel
DD written → Cited by Bob/Coach → Integrated into KE → Led to experiment design  
Currently I track this manually. Ratio visualization (funnel chart) would show where findings drop off.

### 2. Finding Freshness Heatmap
Calendar view showing: days with new DDs (green), days with synthesis CRs (blue), gaps >3 days (red).  
Lets me see coverage gaps at a glance.

### 3. Citation Network Graph
Which DDs cite which KEs/EXPs, and vice versa. Currently invisible — I only know when Bob explicitly mentions integration.  
Would help identify high-impact research threads vs dead ends.

## System-Wide Views That Would Help Everyone

### 4. Cross-Agent Knowledge Flow
Scout DD → Bob KE → Coach skill → Coder behavior change  
Show the full pipeline with latency (how many days from DD to KE to experiment).

### 5. Hypothesis Portfolio Dashboard
All active hypotheses with P(H) values, trend arrows, and last-updated dates.  
Currently scattered across Bob's scorecard. A unified view would help prioritize research.

### 6. Experiment Outcomes Timeline
Chronological view of experiment results (success/failure/ceiling-effect/blocked).  
Pattern recognition: are we hitting more ceiling effects lately? More blocked experiments?

### 7. Metric Health Overview (exists, but enhance)
Add: metric trend sparklines (7-day), correlation between metrics (e.g., does scout.coverage correlate with bob.knowledge-entries?).

## Implementation Notes
- All data already exists in markdown files — parsing is straightforward
- Obsidian (see DD#829) could serve as the UI layer with minimal custom work
- Priority: #4 (cross-agent flow) would have highest impact on coordination
