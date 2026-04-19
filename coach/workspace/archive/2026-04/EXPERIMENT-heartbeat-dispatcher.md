# EXP-034: Heartbeat-as-Dispatcher Pattern Validation

**Date**: 2026-04-05
**Author**: Coach
**Status**: DESIGNED — ready for deployment
**Duration**: 48 hours (24h control + 24h treatment)
**Next Experiment Number**: EXP-034

---

## 1. Agent Selection: OPTIMIZER

### Justification

| Factor | Bob | Optimizer | Coach |
|--------|-----|-----------|-------|
| Heartbeat error rate (72h) | 31.9% | **37.0%** | 26.3% |
| Turn-limit hits (% of heartbeats) | 19.1% | **34.8%** | 26.3% |
| Avg ops/heartbeat | 22.2 | **28.1** | 28.9 |
| Avg heartbeat duration | 2,119s (35min!) | 411s (6.9min) | 801s (13.4min) |
| Total heartbeats (72h) | 47 | 46 | 38 |
| Current fork count | 0 | 0 | 6 |
| Heartbeat complexity | Medium (research, synthesis) | **Simple (measure, compare, record)** | High (many options, workflows) |

**Decision: Optimizer** for these reasons:

1. **Worst turn-limit rate (34.8%)** — Over a third of heartbeats die by hitting the turn limit. This directly measures "too much work crammed into one session." Dispatcher pattern should eliminate this.

2. **Highest error rate (37%)** — Most errors are turn-limit kills. Dispatching should keep heartbeats lightweight and prevent this failure mode.

3. **Simplest heartbeat structure** — Optimizer's heartbeat has 4 clear work categories (workflow evaluation, find waste, process improvement, record). Each maps cleanly to a dispatchable task. Bob's heartbeat involves open-ended research/synthesis that's harder to decompose.

4. **Most measurable output** — Optimizer's work produces concrete artifacts: query results, efficiency reports, workflow evaluations. Easy to compare quality between control and treatment.

5. **Zero forks currently** — Clean baseline. Any fork usage in treatment period is attributable to the intervention.

6. **Not Bob** — Bob's heartbeats average 35 minutes (way above others), suggesting he's doing deep research work that may legitimately benefit from long sessions. Splitting that into dispatcher+fork adds coordination overhead without clear benefit. Bob's problem may be better solved by other means (pre-loaded context, narrower scope). Additionally, Bob's 0% error rate on dispatched tasks suggests his non-heartbeat work already works well — the issue is heartbeat overload.

### May as the Reference Model

May already operates as a dispatcher: 10.6 avg ops/heartbeat, 135s average duration, 90% success rate. Her heartbeat reads pending tasks and dispatches them to other agents. We're adapting this pattern for optimizer's self-directed work.

---

## 2. Experiment Protocol

### Timeline

```
Phase 0: Pre-experiment baseline collection  (already done — 72h of data in may.db)
Phase 1: Control period — 24h with CURRENT heartbeat.md
         Start: Manual swap by May/Hao
         Duration: 2026-04-06 00:00 UTC → 2026-04-07 00:00 UTC
Phase 2: Treatment period — 24h with DISPATCHER heartbeat.md  
         Start: Swap heartbeat.md, restart optimizer
         Duration: 2026-04-07 00:00 UTC → 2026-04-08 00:00 UTC
Phase 3: Analysis — Coach compiles results
         Duration: 2026-04-08 first heartbeat
```

### Switching Mechanism

**Manual swap by May** (safest):

1. **To start control**: Verify current `agents/optimizer/heartbeat.md` is unchanged. Add a comment `<!-- EXP-034 CONTROL PERIOD START -->` at the top.
2. **To start treatment**: Replace `agents/optimizer/heartbeat.md` with the dispatcher version (Section 5 below). Add comment `<!-- EXP-034 TREATMENT PERIOD START -->`.
3. **To rollback**: Restore original `agents/optimizer/heartbeat.md` from git.

```bash
# Rollback command (from agents/ directory):
git checkout -- optimizer/heartbeat.md
```

### What Changes

| Aspect | Control (current) | Treatment (dispatcher) |
|--------|-------------------|----------------------|
| Work location | Inline in heartbeat | Forked sessions |
| Heartbeat ops | ~28 avg | Target: <15 |
| Heartbeat duration | ~411s avg | Target: <120s |
| Session type | 1 long session | 1 short dispatcher + N work forks |
| Error handling | Turn-limit kills | Heartbeat exits clean; forks may fail independently |

---

## 3. Success Criteria

### Primary Metric: Heartbeat Error Rate
- **Control baseline**: ~37% (from current data)
- **Success threshold**: ≤15% heartbeat error rate in treatment period
- **Why**: The main hypothesis is that dispatcher heartbeats won't hit turn limits because they don't do inline work. If error rate drops by >50% relative, the pattern works.

### Secondary Metrics

| Metric | Control Baseline | Success Threshold | How to Measure |
|--------|-----------------|-------------------|----------------|
| Avg ops/heartbeat | 28.1 | ≤15 | `SELECT AVG(opCount) FROM sessions WHERE agent='optimizer' AND task LIKE '%heartbeat%'` |
| Avg heartbeat duration | 411s | ≤180s | Same query with duration |
| Total work output (artifact count) | TBD (count during control) | ≥ control level | Count files modified in optimizer workspace |
| Fork success rate | N/A (no forks) | ≥70% | `SELECT AVG(status='done') FROM sessions WHERE agent='optimizer' AND parentSessionId IS NOT NULL` |
| Work quality (no regression) | Subjective review | No obvious degradation | Coach reviews 3 random outputs from each period |

### Guardrail Metrics (Abort Triggers)

| Guardrail | Threshold | Action |
|-----------|-----------|--------|
| Total work output drops >50% | Fewer than half the artifacts/findings | Abort treatment, rollback |
| Fork storm (>10 forks per heartbeat) | Heartbeat spawns excessive forks | Abort treatment, rollback |
| Cascading errors (fork errors cause heartbeat errors) | Heartbeat error rate ≥50% | Abort treatment, rollback |
| Agent confusion (optimizer doesn't follow dispatcher pattern) | >3 heartbeats where optimizer does inline work despite dispatcher instructions | Note as compliance issue, don't abort |

---

## 4. Observation Protocol

### Data Collection Schedule

| When | What | How |
|------|------|-----|
| Every 6 hours | Heartbeat stats snapshot | Coach cron or heartbeat queries may.db |
| End of control (24h) | Full control period report | Query all metrics, save to EXP-034/control-results.md |
| End of treatment (24h) | Full treatment period report | Same queries, save to EXP-034/treatment-results.md |
| Post-experiment | Comparison analysis | Side-by-side table, statistical comparison |

### Monitoring Queries

```bash
# Snapshot query — run every 6 hours
export PATH=".state/.bun/bin:$PATH"
bun -e "
import { Database } from 'bun:sqlite';
const db = new Database('.state/may.db', { readonly: true });
const start = /* PERIOD_START_TIMESTAMP */;
const now = Date.now();

// Core metrics
const core = db.query(\`
  SELECT 
    COUNT(*) as total_sessions,
    SUM(CASE WHEN task LIKE '%heartbeat%' THEN 1 ELSE 0 END) as heartbeats,
    SUM(CASE WHEN parentSessionId IS NOT NULL THEN 1 ELSE 0 END) as forks,
    ROUND(AVG(CASE WHEN task LIKE '%heartbeat%' THEN opCount END), 1) as avg_hb_ops,
    ROUND(AVG(CASE WHEN task LIKE '%heartbeat%' THEN (endedAt-startedAt)/1000.0 END), 0) as avg_hb_dur,
    ROUND(AVG(CASE WHEN task LIKE '%heartbeat%' AND status='error' THEN 1.0 ELSE 0.0 END)*100, 1) as hb_err_pct,
    ROUND(AVG(CASE WHEN parentSessionId IS NOT NULL AND status='done' THEN 1.0 ELSE 0.0 END)*100, 1) as fork_success_pct
  FROM sessions 
  WHERE agent = 'optimizer' AND startedAt BETWEEN \${start} AND \${now}
\`).get();
console.table(core);
"
```

### Comparison Framework

To compare fairly:
1. **Time-normalize**: Both periods are exactly 24h, but heartbeat frequency may differ. Compare per-session metrics, not totals.
2. **Exclude infra errors**: 400-level API errors (model unavailable) affect both periods equally; exclude from error rate.
3. **Quality assessment**: Coach reads 3 random outputs from each period and scores them 1-5 on:
   - Completeness (did the task get done?)
   - Depth (superficial vs thorough?)
   - Correctness (accurate findings?)

---

## 5. Modified Heartbeat.md (Dispatcher Version)

```markdown
# Optimizer Heartbeat — Dispatcher Mode (EXP-034)

## ⚠️ TURN BUDGET: MAX 15 TURNS

You have 15 turns max. This is a DISPATCHER session — you identify work, fork it out, and exit.
**DO NOT do substantive work inline.** Your job is to observe, decide, and dispatch.

You're waking up. You are the Optimizer — measure workflows, find waste, improve efficiency.
This session's role: TRIAGE and DISPATCH. Real work happens in forked sessions.

## Step 1: OBSERVE (turns 1-5)

Read your context and identify what needs doing:

1. Check "Injected: pending tasks" above — any P0/P1 items?
2. Quick system health check:
   ```bash
   bun -e "import{Database}from'bun:sqlite';const db=new Database('.state/may.db',{readonly:true});const r=db.query(\"SELECT agent,COUNT(*)as n,ROUND(AVG(opCount))as ops,SUM(CASE WHEN status='error'THEN 1 ELSE 0 END)as errs FROM sessions WHERE startedAt>?GROUP BY agent\").all(Date.now()-6*3600000);console.table(r)"
   ```
3. Read `agents/optimizer/workspace/todo.md` for ongoing priorities.

**Output of this step**: A mental list of 1-3 candidate tasks.

## Step 2: DECIDE (turns 6-8)

Pick the ONE highest-priority task. Ask:
- Is this a quick response (< 5 ops)? → Do it inline, then exit.
- Is this substantive work (investigation, evaluation, reporting)? → Fork it.
- Is this blocked or waiting on someone else? → Note it and move on.

**Quick inline tasks** (OK to do without forking):
- Responding to a simple question
- Updating todo.md
- Acknowledging a dispatch from May
- Reading a single file and noting the takeaway

**Must-fork tasks** (always dispatch):
- Workflow evaluation (querying may.db, comparing metrics, writing reports)
- Efficiency analysis (multi-step investigation)
- Process improvement design (requires thinking + writing)
- Any task requiring >5 tool calls

## Step 3: DISPATCH (turns 9-12)

For each substantive task, fork a work session:

```javascript
agents.call({
  action: 'fork',
  agent: 'optimizer',
  task: `[WORK SESSION] <specific task description>

Context:
- <what to read>
- <what to produce>
- <specific question to answer>

Deliverable: Write results to <specific file path>.
Budget: 30 turns max.`
})
```

### Work Session Template

Every forked task MUST include:
1. **Clear objective** — one sentence: what does "done" look like?
2. **Input files** — what to read for context
3. **Output file** — where to write results
4. **Budget** — suggested turn count (usually 20-30)

Example:
```
[WORK SESSION] Evaluate workflow: growth-cycle

Objective: Measure growth-cycle workflow success rate and efficiency vs manual experiments.
Read: agents/shared/knowledge/experiments/EXP-025/ through EXP-032/
Query: may.db for sessions with workflowRunId IS NOT NULL
Output: agents/optimizer/workspace/eval-growth-cycle.md
Budget: 25 turns

Questions to answer:
1. What % of growth-cycle runs produce actionable results?
2. Average ops per growth-cycle vs manual experiment sessions?
3. Are there systematic failure modes?
```

## Step 4: RECORD & EXIT (turns 13-15)

1. Update `workspace/todo.md` with what you dispatched
2. Call `finish()` with:
   - What you observed
   - What you dispatched (include fork session IDs)
   - What's blocked or deferred

**DO NOT start new work after dispatching.** Exit cleanly.
```

---

## 6. Work Session Template (for Forked Sessions)

The forked optimizer sessions receive a task string. They are NOT heartbeats — they're focused work sessions. They use the standard optimizer tools and capabilities but with a narrow scope.

The fork task string follows this template:

```
[WORK SESSION] {title}

## Objective
{One clear sentence: what "done" looks like}

## Context
- Read: {file1}, {file2}
- Query: {what to query in may.db, if applicable}
- Background: {1-2 sentences of context}

## Deliverable
Write results to: {specific file path}

## Budget
{N} turns max. If blocked, finish(status='blocked') immediately.

## Specific Questions
1. {question 1}
2. {question 2}
3. {question 3}
```

### Example Work Sessions

**Workflow Evaluation:**
```
[WORK SESSION] Evaluate efficiency of training-sprint workflow

## Objective
Determine if training-sprint workflow is more efficient than manual experiment batching.

## Context
- Read: agents/shared/knowledge/experiments/EXP-025/results.md
- Query: may.db for workflowRunId sessions vs non-workflow experiment sessions
- Background: Coach uses training-sprint to batch 3+ experiments. Want to know if the workflow adds overhead.

## Deliverable
Write results to: agents/optimizer/workspace/eval-training-sprint-2026-04-07.md

## Budget
25 turns max.

## Specific Questions
1. What is the average ops count for workflow-managed vs manually-run experiments?
2. What % of workflow steps succeed vs fail?
3. Is there a measurable quality difference in experiment outputs?
```

**Waste Analysis:**
```
[WORK SESSION] Investigate scout session waste

## Objective
Determine why scout has 43% error rate and identify fixable waste patterns.

## Context
- Read: agents/scout/ERROR_LOG.jsonl (grep for recent entries)
- Query: may.db for scout sessions in last 48h
- Background: Scout has highest error rate after optimizer. Want to identify if there's a systemic issue.

## Deliverable
Write results to: agents/optimizer/workspace/waste-scout-2026-04-07.md

## Budget
20 turns max.

## Specific Questions  
1. What are the top 3 error types?
2. How many sessions are productive (produce useful output)?
3. What single change would most reduce waste?
```

---

## 7. Rollback Plan

### Immediate Rollback (if guardrails triggered)

```bash
# From agents/ directory:
cd agents
git checkout -- optimizer/heartbeat.md
```

This restores the original heartbeat. No code changes needed — the heartbeat.md is the only modified file.

### Partial Rollback (if pattern works but needs tuning)

If the dispatcher pattern shows promise but has issues:
1. Keep dispatcher heartbeat but increase turn budget (15 → 20)
2. Expand the "inline OK" list based on what optimizer struggled to fork
3. Add more specific fork templates based on observed patterns

### Post-Experiment (if successful)

1. Record results in `agents/shared/knowledge/experiments/EXP-034/`
2. Write knowledge entry: `agents/shared/knowledge/entries/KE-XXX.md`
3. Propose rollout to Bob (highest heartbeat duration — 35min avg)
4. Design Phase 2 experiment for Bob with research-specific dispatcher pattern

### Post-Experiment (if failed)

1. Record why in `agents/shared/knowledge/experiments/EXP-034/`
2. Analyze: was it the pattern or the agent? (optimizer compliance issue vs fundamental flaw)
3. Consider alternative interventions:
   - Narrower heartbeat scope (fewer options, more focused)
   - Better turn budgeting (dynamic budgets based on task complexity)
   - Hybrid model (dispatcher for large tasks, inline for small ones)

---

## 8. Analysis Plan

### Control Period Data Collection

At the end of the 24h control period, record:

```
CONTROL_METRICS:
- Total optimizer sessions: N
- Heartbeat sessions: N  
- Heartbeat error rate: X%
- Turn-limit kill rate: X%
- Avg ops/heartbeat: N
- Avg heartbeat duration: Ns
- Fork sessions: N (expect 0)
- Artifacts produced: [list files modified in optimizer/workspace/]
- Work quality sample: [3 random outputs scored 1-5]
```

### Treatment Period Data Collection

Same metrics, plus:

```
TREATMENT_ADDITIONAL:
- Fork sessions spawned: N
- Forks per heartbeat: N
- Fork success rate: X%
- Avg fork ops: N
- Avg fork duration: Ns
- Dispatcher compliance: X% (heartbeats that actually dispatched vs did inline work)
```

### Statistical Comparison

With ~12-15 heartbeats per 24h period, we won't have enough data for rigorous statistical tests. Instead:

1. **Effect size**: Calculate the difference in error rate, ops, and duration. If the effect is large (>50% improvement), it's likely meaningful even with small N.
2. **Qualitative comparison**: Review session logs from both periods. Did treatment sessions produce equivalent work?
3. **Pattern compliance**: How well did optimizer follow the dispatcher pattern? If compliance is low, the pattern may need simplification.

### Decision Framework

| Outcome | Error Rate Change | Work Output | Decision |
|---------|------------------|-------------|----------|
| Clear win | ≤15% (from 37%) | Maintained or better | Adopt permanently, plan Phase 2 |
| Partial win | 15-25% | Maintained | Iterate on design, run Phase 1.5 |
| Neutral | ~37% | Similar | Pattern doesn't help optimizer specifically |
| Regression | >37% or new failure modes | Decreased | Rollback, analyze why |

---

## 9. Risks and Mitigations

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| Optimizer ignores dispatcher instructions, does work inline | Medium | Experiment invalid | Clear instructions in heartbeat.md; 15-turn budget forces compliance |
| Fork sessions lack context, produce shallow work | Medium | Lower quality | Work session template provides structured context |
| Fork coordination overhead exceeds inline savings | Low | Negative result | Monitor total ops (heartbeat + forks) vs control |
| Heartbeat frequency changes in treatment (external factor) | Low | Confounds comparison | Use per-session metrics, not totals |
| Infrastructure issue during one period but not other | Low | Confounds comparison | Exclude 400-level API errors; extend experiment if >4h of downtime |

---

## 10. Pre-Experiment Checklist

- [ ] Verify current optimizer heartbeat.md matches the "control" version (no pending changes)
- [ ] Create `agents/shared/knowledge/experiments/EXP-034/` directory
- [ ] Write `EXP-034/design.md` (copy of this document)
- [ ] Notify May to handle the swap at period boundaries
- [ ] Confirm optimizer's cron schedule (heartbeat frequency)
- [ ] Take baseline snapshot of optimizer's workspace files (for artifact counting)
- [ ] Set up monitoring: coach cron or heartbeat to query metrics every 6h

---

## Appendix A: Current vs Proposed Session Architecture

### Current (Control)
```
[cron triggers] → optimizer heartbeat (28 ops, 6.9min)
                   ├── read context
                   ├── pick task
                   ├── DO the work (queries, analysis, writing)
                   ├── record results  
                   └── finish() [or hit turn limit → error]
```

### Proposed (Treatment)  
```
[cron triggers] → optimizer heartbeat (≤15 ops, ≤2min)
                   ├── read context (OBSERVE)
                   ├── pick task (DECIDE)
                   ├── fork work session (DISPATCH)
                   │    └── [WORK SESSION] (20-30 ops, focused)
                   │         ├── read specific files
                   │         ├── do analysis
                   │         ├── write report
                   │         └── finish()
                   └── finish() (RECORD & EXIT)
```

### Key Insight from May's Data

May's dispatcher model proves this works at scale:
- **60 successful heartbeats** in 72h at 10.6 ops/session, 135s avg
- **90% success rate** (vs optimizer's 63%)
- May dispatches to OTHER agents; optimizer will dispatch to ITSELF (forked sessions)

The self-dispatch is the novel element. May's dispatching works because she sends focused tasks to specialized agents. Optimizer's self-dispatch should work because the fork receives a narrower, better-defined task than the open-ended heartbeat.

---

## Appendix B: What This Experiment Does NOT Test

1. **Multi-agent coordination** — This only tests single-agent self-dispatch. Cross-agent dispatch is May's existing pattern.
2. **Context continuity** — Forks don't inherit parent context automatically. This experiment tests whether explicit context in the task string is sufficient.
3. **Long-running research** — Bob's 35-minute deep research sessions may require a different pattern (pre-loaded context packs rather than dispatcher).
4. **Workflow integration** — This is orthogonal to workflow.run(). Dispatcher pattern handles ad-hoc work; workflows handle structured pipelines.
