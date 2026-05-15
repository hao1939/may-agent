# Finding: Workflow Health — High-Op Session Bypass Analysis

**Date**: 2026-04-14  
**Mode**: D (Workflow Health)  
**Analyst**: optimizer  

## Hypothesis

High-op sessions (>50 ops) correlate with workflow bypass. If so, workflow enforcement could cap runaway sessions.

## Data (last 24h, from may.db)

### High-Op Sessions by Workflow Status

| Category | Count | Avg Ops | Sessions |
|---|---|---|---|
| No tag, no workflowRunId | 7 | 95.0 | tech-lead(182), scout(140), tech-lead(94), bob(69), coach(65), bob(60), coach(55) |
| [WORK SESSION] tag but NO workflowRunId | 10 | 81.9 | coach(133), coach(118), tech-lead(86), tech-lead(84), bob(84), bob(81), optimizer(63), tech-lead(59), bob(57), coach(54) |
| Workflow-managed (has workflowRunId) | 2 | 91.5 | bob(126), optimizer(57) |

**Key stat: 17 of 19 high-op sessions (89%) lack a workflowRunId.**

### Op Bucket Analysis

| Bucket | Total | With Workflow | Without Workflow | % Without |
|---|---|---|---|---|
| >80 ops | 10 | 1 | 9 | 90% |
| 51-80 ops | 9 | 1 | 8 | 89% |
| 31-50 ops | 42 | 4 | 38 | 90% |
| 1-30 ops | 547 | 24 | 523 | 96% |

Workflow sessions are rare at every level (5% overall, 30/608), but the high-op distribution matches the baseline — workflow doesn't prevent high-op sessions.

### Workflow vs Non-Workflow Averages

| Type | Sessions | Avg Ops | Max Ops | Total Ops |
|---|---|---|---|---|
| Has workflowRunId | 30 | 20.7 | 126 | 620 |
| [WORK SESSION] tag only | 318 | 14.6 | 133 | 4,641 |
| Non-workflow | 259 | 12.1 | 182 | 3,132 |

**Counterintuitive**: Workflow-managed sessions average **higher** ops (20.7) than non-workflow (12.1). This is likely a selection effect — workflows are used for complex tasks that inherently take more ops.

### Per-Agent Breakdown

| Agent | Non-WF Avg | Non-WF Max | WF Avg | WF Max | WF Count |
|---|---|---|---|---|---|
| bob | 15.5 (80) | 84 | 21.7 (12) | 126 | 12 |
| coach | 16.2 (98) | 133 | 18.0 (2) | 22 | 2 |
| optimizer | 15.1 (89) | 63 | 25.1 (8) | 57 | 8 |
| tech-lead | 15.9 (99) | 182 | — | — | 0 |
| scout | 13.2 (59) | 140 | 17.0 (1) | 17 | 1 |

**Tech-lead has zero workflow sessions** despite having the highest single-session ops (182). Coach has only 2. Bob has 12 (most).

### Top 6 High-Op Sessions — Root Causes

1. **tech-lead 182 ops** — "URGENT: Evaluator LLM evaluations broken for 3.5 days." No workflow, no work-session tag. Ad-hoc urgent fix. Source: agents.fork.
2. **scout 140 ops** — "Lens B: workflow.run() agent resolution bug." Debugging task dispatched by callAgent. Complex investigation.
3. **coach 133 ops** — "[WORK SESSION] Design EXP-154." Interrupted (aborted). Exploration-heavy design task.
4. **bob 126 ops** — "[WORK SESSION] Scenario Gap-Fill." The ONLY high-op session with workflowRunId. Currently still running. Source: workflow engine.
5. **coach 118 ops** — "[WORK SESSION] Design Hard Scenario for H-161." Design task.
6. **tech-lead 94 ops** — "Review branch for merge readiness." Code review task.

### Workflow Session Health

| Status | Count | Avg Ops |
|---|---|---|
| done | 29 | 17.0 |
| running | 1 | 126 |

29/30 completed workflow sessions finished successfully (no errors). The 1 running is the bob 126-op session.

## Findings

### F1: Workflow bypass is NOT the cause of high-op sessions
The hypothesis was wrong. The data shows:
- **89% of high-op sessions lack workflowRunId**, but this matches the baseline (95% of ALL sessions lack it)
- The 2 workflow-managed high-op sessions (bob 126, optimizer 57) are just as bloated
- Workflow sessions actually average MORE ops (20.7 vs 12.1), not fewer

### F2: The real pattern — high-op sessions are complex tasks, not structural failures
The top 6 are: urgent debugging (182), bug investigation (140), experiment design (133, 118), scenario design (126), code review (94). These are inherently complex tasks that resist budgeting.

### F3: Workflow adoption is still low for high-volume agents
- **Tech-lead: 0 workflow sessions** (99 non-workflow sessions, max 182 ops)
- **Coach: 2 workflow sessions** (98 non-workflow, max 133 ops)
- **Bob: 12 workflow sessions** (80 non-workflow) — most adoption, but workflows don't help cap ops

### F4: Workflow health is excellent — 29/30 completed successfully
Zero errors in workflow sessions. The issue isn't workflow reliability, it's workflow coverage — most work bypasses workflows entirely.

## Implications

1. **Workflow enforcement alone won't cap high-op sessions.** Even the workflow-managed bob session hit 126 ops. Workflows don't include per-session budget caps.
2. **The real lever is per-session maxTurns/budget caps** (already noted in OBSERVATIONS: "infra fix maxRestarts=3 or maxTurns=80 would cap all >100 op sessions").
3. **Increasing workflow coverage for coach and tech-lead** could improve structure, but won't reduce ops without explicit budget enforcement within the workflow.
4. **The [WORK SESSION] tag is decorative** — 10 of 19 high-op sessions have it but no workflowRunId. The tag doesn't imply workflow management.

## Recommendation

No new intervention needed. The existing observation about `maxTurns=80` infra cap is the correct fix for >100 op sessions. Workflow adoption improvements (Mode C finding: 70.1% trending up) are valuable for structure but won't address the high-op tail.

---
*Query window: last 24h from 2026-04-14 06:52 UTC. 608 sessions with ops > 0.*
