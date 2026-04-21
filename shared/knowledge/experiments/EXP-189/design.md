# EXP-189 Design: Production Deployment of G' Question-Framing

**Date**: 2026-04-22
**Status**: OBSERVING
**Parent**: instruction-following (iter 10)
**Predecessor**: metric-autonomy iters 1–5 (variant G = 30/30 pooled)

---

## Research Question

Does the G' question-first-step reframe, which achieved 100% metric-reaction
in gym (30/30 pooled), produce measurable metric-reaction lift in production
heartbeats?

## Background

Variant G' modifies the heartbeat prompt to insert a question-first block
when below-target metrics are detected:

```
## ⚡ FIRST — evaluate your red metrics before anything else
**Question**: Which metric above is furthest from its target? Follow the
"→ Quick check" breadcrumb for that metric NOW — run the command or query.
Then decide: is this urgent enough to act on this heartbeat, or can it wait?
```

This was tested in gym as `metric-reaction-Gp` against coder. The mechanism
is: by making metric evaluation the agent's **first step** (question-framing),
the agent acts on metrics before falling into its default dispatch routine.

## Current Deployment State

G' is **already deployed** to three production heartbeat workflows:
- `agents/may/workflows/may-heartbeat.ts` — ✅ has G' block
- `agents/bob/workflows/bob-heartbeat.ts` — ✅ has G' block
- `agents/coach/workflows/coach-heartbeat.ts` — ✅ has G' block

Coder does **not** have a heartbeat workflow file (no `agents/coder/workflows/`).

## Method

### Observation Period
Since G' is already deployed, this experiment is **observational**:

1. **Baseline window**: Heartbeat sessions before G' deployment date.
   Count sessions where agent had below-target metrics but took no metric action.
2. **Treatment window**: 7 days of heartbeat sessions post-deployment.
   Count sessions where agent had below-target metrics and:
   - Ran a diagnostic command related to the breached metric
   - Read a metric-related file
   - Mentioned the metric in finish() summary with action taken/planned

### Measurement

```sql
-- Count heartbeat sessions with below-target metrics
-- Manual review: did the agent investigate the red metric?
-- Track in: agents/coach/workspace/experiments/EXP-189-observations.md
```

For each heartbeat session in the treatment window where `⚠️ BELOW TARGET`
was injected, classify as:
- **REACTED**: Agent investigated the metric (ran command, read file, or took action)
- **IGNORED**: Agent skipped to default dispatch routine

### Success Criteria
- Production metric-reaction rate ≥ 80% (matching gym performance)
- n ≥ 10 observations with below-target metrics across all agents

### Risks
- Agents may not have below-target metrics frequently → slow data collection
- Production heartbeats have richer context (projects, alerts) that may
  distract from metrics even with G' framing
- G' only fires when `hasRedMetrics` is true — if metrics are stale/null,
  G' never activates

## Timeline
- Week 1: Passive observation, collect ≥10 datapoints
- Week 2: Analyze, report results, decide on coder deployment
