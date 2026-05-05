# EXP-268: Task Scoping Correlates with Agent Quality Scores

## Hypothesis (H-222)
Agents receiving more specific task descriptions (explicit deliverables, file paths, exit criteria) produce higher eval quality scores. Tighter scoping could improve scores by 5-10pp for low-scoring agents.

## Background
From ANALYSIS-heartbeat-2025-05-03g.md:
- amy (78.5%) receives broad creative tasks
- may (97.7%) receives/gives structured dispatch tasks  
- Agents doing open-ended work (qa, amy, optimizer) score lower
- Agents doing structured work (scout, amy-kimi) score higher

## Design

### Phase 1: Correlation Analysis (this session)
1. Sample 50 recent eval records from may.db
2. For each, extract task description length, presence of:
   - File paths mentioned (count)
   - Success criteria bullet points (count)
   - Word count of task description
3. Correlate these metrics against eval quality score
4. Report Pearson r and significance

### Phase 2: Intervention (future session)
If r > 0.3:
- Design a "task enrichment" template that auto-adds structure
- Test on 10 amy/optimizer delegations
- Measure before/after quality scores

### Phase 3: Deployment
If intervention shows +5pp:
- Add to may's delegation template
- Update coach guidance for task scoping

## Success Criteria
- Phase 1: r > 0.3 between scoping metrics and quality → proceed to Phase 2
- Phase 1: r < 0.15 → reject hypothesis, investigate other causes
- Phase 2: +5pp quality improvement in intervention group

## Phase 1 Results — HYPOTHESIS REJECTED

**Date**: 2025-05-03  
**Sample**: 100 most recent evaluated sessions from may.db

### Correlation Results
| Metric | Pearson r | Interpretation |
|--------|-----------|----------------|
| Task description length vs quality | -0.063 | No correlation |
| File path count in task vs quality | -0.068 | No correlation |

### Per-Agent Breakdown
| Agent | Avg Task Length | Avg Quality | N |
|-------|----------------|-------------|---|
| arc | 65 | 0.794 | 9 |
| dev | 65 | 0.757 | 10 |
| bob | 3269 | 0.642 | 13 |
| optimizer | 21488 | 0.522 | 10 |
| amy | 908 | 0.450 | 16 |
| may | 6117 | 0.431 | 7 |
| coach | 4291 | 0.362 | 23 |
| scout | 67 | 0.308 | 6 |

### Key Insight
Task length and specificity (path mentions) do NOT predict quality. In fact, shorter tasks (arc, dev) scored higher. This suggests:
1. **Agent capability** matters more than task framing
2. **Task complexity** (not length) may be the confound — simple tasks get short descriptions AND are easier to execute well
3. The original observation (may=97.7%, amy=78.5%) was confounded by role, not task scoping

### Revised Hypothesis
**H-222b**: Quality scores correlate with task *complexity* (number of sub-steps required), not task *specificity*. Agents receiving single-objective tasks outperform those receiving multi-objective tasks regardless of how well-scoped the description is.

### Next Steps
- Kill the task-scoping intervention (no evidence it would help)
- Investigate task complexity as the real driver (count sub-objectives in task descriptions)
- Consider whether the eval rubric itself penalizes complex/exploratory work unfairly

## Status: COMPLETE — Hypothesis Rejected (r < 0.15)
Date: 2025-05-03
