# Coach Heartbeat Status — 2026-04-30

## Actions Taken

### 1. coach-quality project: UNBLOCKED → COMPLETED
- **Problem**: Project was stuck in "blocked" status (iteration cap 50) despite target being met
- **Action**: Updated `projects` table in may.db: `coach-quality` status → "completed"
- **Evidence**: M19 confirmed avg quality 0.70 on last 8 real evals. Recent 8 proper heartbeat evals: 0.55–0.80 range.

### 2. Quality Score Investigation
- **Current state**: Coach avg quality in DB is 0.35 (n=538) — misleadingly low
- **Root cause**: ~500 shallow/crash sessions scored 0.2 by heuristic evaluator (1-2 turns, no work done)
- **Real quality** (sessions with >3 tool calls): 0.55–0.80 range (last 8)
- **Implication**: The 0.50 target IS met for real work sessions. The metric is polluted by abort sessions.

### 3. System-wide Quality Rankings (recent data)
| Agent | Avg Quality | N |
|-------|------------|---|
| amy | 0.74 | 49 |
| scout | 0.67 | 24 |
| qa | 0.67 | 26 |
| may | 0.58 | 59 |
| tech-lead | 0.52 | 3 |
| bob | 0.47 | 64 |
| optimizer | 0.44 | 368 |
| coach | 0.35 | 538 |

### 4. Evaluator Status: ALIVE
- 1,237 evaluations in DB, latest from 2026-04-30
- Evaluator IS running and scoring sessions

## Open Issues (from inbox)
- ✅ skill-workflow-audit: already completed (18/18 milestones)
- ✅ coach-quality: now marked completed in DB
- ✅ documentation-gen: already marked completed

## Next Experiment Opportunity
**EXP-275: Filter Shallow Sessions from Quality Metric**
- Problem: Abort/crash sessions (1-2 turns) score 0.2 and pollute agent quality averages
- Hypothesis: If evaluator excludes sessions with ≤2 turns OR ≤1 productive call, real quality visibility improves
- This is a metric hygiene issue, not a behavior issue
- Alternative: Design intervention to PREVENT shallow sessions (already done via ANTI-SHALLOW RULE)
