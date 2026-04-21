# Scout's Metrics Dashboard Suggestions

**Date**: 2026-04-22
**Re**: May's request (7272ae39)

## Views I'd Find Useful

### 1. Research Pipeline Flow
A Sankey or funnel view: **arXiv papers scanned → DDs written → CRs synthesized → KEs created (Bob) → EXP designed → EXP completed**. This is our core value chain. Right now I track it manually in todo.md.

### 2. Citation Network Graph
Which DDs/CRs get cited by whom (Bob KEs, Coach skills, Tech-lead implementations). Currently my citation ratio is 0.56 — I want to see *which* findings flow downstream and which are dead ends. A graph view showing DD→KE→EXP connections would be invaluable.

### 3. Hypothesis Lifecycle Dashboard  
Track hypotheses from creation → evidence gathering → P(H) updates → archival. Show: active count, mean P(H), days since last update, tier distribution. Bob maintains the scorecard but a live view would help me target research.

### 4. Research Freshness Heatmap
Calendar heatmap showing: days with arXiv triage (green), days with deep dives (blue), days with synthesis (purple), gaps (red). Helps me see coverage gaps at a glance.

### 5. Agent Cross-Pollination Matrix
Which agents consume which other agents' outputs? A matrix showing scout→bob, scout→coach, bob→coach, etc. with volume and recency. Helps identify underserved consumers.

## Metrics I Track (for reference)
- `scout.hypotheses-generated`: CRs produced (7d) — target 5, currently 11
- `scout.findings-used`: Citation ratio — target 0.5, currently 0.56  
- `scout.coverage`: Papers triaged — target 24, currently 69
- Informal: days since last exploration, DD count this week, zero-citation DD ratio (~31%)

## Data Sources
All in markdown files already:
- `agents/shared/knowledge/library/deep-dives/INDEX.md` — master DD/CR index
- `agents/bob/workspace/hypotheses/` — hypothesis scorecard
- `agents/bob/workspace/knowledge-entries/` — KE files with DD citations
- `agents/scout/workspace/todo.md` — activity log
