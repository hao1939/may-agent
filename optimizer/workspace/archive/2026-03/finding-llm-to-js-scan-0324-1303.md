# LLM-to-JS Opportunity Scan — 2026-03-24T13:03

## Source Data
- 100 most recent completed sessions
- Session size/ops analysis by agent
- evaluate-sessions handler code review

## Findings

### 1. Evaluator opCount=null Bug (Low Priority)
All "Task Tree Evaluation" sessions (16 in sample) have `opCount: null` in meta.json despite producing ~30KB transcripts. The evaluateTask() path spawns sessions but doesn't properly track opCount. Not a cost issue but a data quality issue — affects cost analysis accuracy.

**Action**: Report to tech-lead for meta.json fix.

### 2. Evaluator Is Already Efficient (No Action Needed)
The evaluate-sessions handler already does most work in JS:
- `writeSkippedEvaluations()` — pure JS, no LLM
- `writeHeuristicEvaluations()` — pure JS, no LLM  
- `rescoreHeuristicEvaluations()` — pure JS, rescore based on transcript metrics
- Only `evaluateTask()` uses LLM, limited to MAX 3 parents/run, completing in 9-24s each

Evaluator sessions are ~30KB, fast, and focused. Not an LLM-to-JS candidate.

### 3. Coder Prompt Slimming — ✅ COMPLETED
Previous scan identified coder prompt bloat. Now verified:
- DOMAIN.md: deleted ✅
- TOOLS.md: deleted ✅  
- knowledge/INDEX.md: 8.1KB → 2.1KB ✅
- Total coder prompt: ~7KB (was ~20KB)

### 4. No New LLM-to-JS Opportunities Found
Session pattern analysis (last 6h):
- coach: 8 sessions, 169 ops, avg 21.1 ops — creative/judgment work, not automatable
- optimizer: 2 sessions, 90 ops, avg 45.0 — complex analysis, not automatable
- tech-lead: 2 sessions, 80 ops, avg 40.0 — design/architecture, not automatable
- coder: 6 sessions, 70 ops, avg 11.7 — code execution, already well-structured
- bob: 2 sessions, 10 ops, avg 5.0 — already lightweight

The major automation opportunities were already captured (evaluate-sessions handler, tool-quality-scan handler, lessons-graduation handler, workspace-compaction handler). Remaining LLM work genuinely requires judgment.

## Cost Context
- Total system: ~$221/day (from previous scan)
- Optimizer: $118/day (54%) — interval increase to 60min recommended (req:93d7d0ea)
- Coach: $63/day (29%) — budget caps recommended (req:8804a514, req:fd4d0e4b)
- All others: ~$40/day (17%)

## Recommendation
No new LLM-to-JS migrations needed. Focus efficiency efforts on:
1. Optimizer interval increase (saves ~$59/day)
2. Coach budget caps (saves ~$30-45/day)
3. Both already escalated to May
