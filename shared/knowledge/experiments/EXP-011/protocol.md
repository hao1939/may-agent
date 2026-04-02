# EXP-011: Decision Topology Prediction Accuracy (Retrospective)

**Date**: 2026-04-02
**Hypothesis**: The decision topology model (H-041) can predict whether workflow structuring will help or hurt a task, based on the ratio of eliminable to essential decisions.
**Type**: Retrospective validation study
**Cost**: $0 (uses existing data)
**Status**: DESIGNED — ready for Phase 1 execution

## Background

H-041 predicts that task quality under workflow is determined by:
```
Expected_benefit = α × N_elim - γ × N_ess
```
where α ≈ γ ≈ 5-10pp per decision (calibrated from DD#484 + EXP-009).

The simplest testable prediction: **If N_elim > N_ess, workflow helps. If N_ess > N_elim, workflow hurts.**

## Method

### Phase 1: Retrospective Classification (This Session)

1. Select 20 sessions from may.db with workflow verdict data:
   - 10 workflow sessions (5 good, 5 NI/acceptable)
   - 10 non-workflow sessions for same agent-task combinations

2. For each session, classify the task's decision landscape using only the task description:
   - N_elim: how many decisions have a known-correct answer?
   - N_ess: how many decisions require genuine judgment?
   - N_nav: how many decisions are "meta" (how to proceed)?
   - Compute ratio R = N_elim / (N_elim + N_ess + N_nav)

3. **Blind prediction**: Before looking at the verdict, predict:
   - If R > 0.5: workflow should help → predict good/acceptable
   - If R < 0.5: workflow should hurt → predict NI/poor

4. **Correlate**: Does R predict verdict? Does workflow/non-workflow interact with R?

### Phase 2: Prospective Prediction (Future Session)

1. Before 20 upcoming tasks, classify decision landscape
2. Record prediction of optimal architecture (Mode A or Mode B)
3. After completion, measure actual verdict
4. **Success criterion**: >70% prediction accuracy

## Phase 1 Execution Plan

### Step 1: Extract candidate sessions
```sql
SELECT s.sessionId, s.agent, s.task, s.status, 
       e.verdict, e.quality, s.workflowRunId
FROM sessions s 
JOIN evaluations e ON s.sessionId = e.sessionId
WHERE e.verdict IN ('good', 'acceptable', 'needs_improvement')
AND s.startedAt > [24h ago]
ORDER BY s.startedAt DESC
```

### Step 2: Classify each task
For each task description, estimate decision counts:
- **Eliminable decisions**: those where the correct action is always the same
  - "Read the file before editing" → eliminable
  - "Run tests after changes" → eliminable
  - "Check conventions" → eliminable
  - "Format output correctly" → eliminable

- **Essential decisions**: those requiring task-specific judgment
  - "Which approach to take for this bug" → essential
  - "What hypothesis best explains this data" → essential
  - "Whether this result is good enough" → essential
  - "How to decompose this complex problem" → essential

- **Navigation decisions**: meta-decisions about process
  - "Should I ask for help or continue" → navigation
  - "Should I try approach A or B first" → navigation
  - "Do I have enough information" → navigation

### Step 3: Test correlation
Compute Spearman rank correlation between R (eliminable ratio) and verdict quality score (good=3, acceptable=2, NI=1, poor=0).

## Success Criteria

- **Primary**: Spearman ρ > 0.3 between R and verdict (p < 0.05)
- **Secondary**: >70% accuracy on binary prediction (helps/hurts)
- **Exploratory**: Different α/γ estimates from calibration

## Potential Confounds

1. **Post-hoc bias**: Knowing outcome may influence classification
   - Mitigation: classify based solely on task description, not session details
2. **Agent skill variation**: Some agents are better regardless of task type
   - Mitigation: compare within-agent (same agent, different tasks)
3. **Task difficulty**: Harder tasks may have more essential decisions AND worse outcomes
   - Mitigation: control for agent and task type

## Dependencies

- may.db access (available)
- Session task descriptions (available from sessions table)
- No external resources needed

---

*EXP-011 Protocol | Bob (Architect) | 2026-04-02*
