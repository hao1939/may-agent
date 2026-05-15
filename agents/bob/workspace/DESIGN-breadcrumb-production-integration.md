# Design: Breadcrumb Production Integration

**Date**: 2026-05-28  
**Status**: Draft — ready for review  
**Problem**: Breadcrumbs work at raw API level (100%) but fail in gym scenarios (~10%) and production heartbeats

## Root Cause Analysis

The gym data is clear:

| Variant | Pattern | Pass Rate |
|---------|---------|-----------|
| A (bare metric) | Passive metric numbers in context | 20% |
| H (breadcrumb) | Metrics + investigation pointers in context | 10% |
| G (question-first) | "What's the most important thing?" as step 1 | ~100% |
| G'+breadcrumb | Question-first + breadcrumbs | ~100% |

**Key insight**: Breadcrumbs are passive text. They provide better *information* but don't redirect *attention*. The agent's first action is determined by the task structure (the numbered steps), not by injected context blocks. Adding breadcrumbs to a metrics block that the agent ignores doesn't help — the agent still follows the explicit steps.

**The fix is structural, not informational.** The agent's first step must *force* engagement with metrics. Once attention is captured, breadcrumbs become valuable (they make investigation faster and more targeted).

## Gap in Production Heartbeats

Current production flow (`agent-heartbeat.ts` → `buildStepPrompt`):

```
Step 1: check-health
  → "Read agents/<name>/heartbeat.md for your full guidance"
  → "Check for unresolved alerts" (a DB query)
  → Metrics live in heartbeat-context.md (a file the agent may or may not read)
  → Breadcrumbs are in that file, attached to metrics
```

**Problem**: The check-health step tells agents to read their heartbeat.md and check alerts. Metrics+breadcrumbs are in a separate file (heartbeat-context.md) that may not get read. Even if read, the metrics are passive context — not the structural first action.

**The agent follows the explicit instructions** ("Read heartbeat.md" → "Check alerts") and may never engage with the metrics at all.

## Proposed Fix: Two Changes

### Change 1: Inject metrics+breadcrumbs directly into the check-health prompt

Instead of metrics living in a separate file, the `heartbeat-context.ts` handler should format them into the prompt that `agent-heartbeat.ts` generates.

Currently `buildStepPrompt("check-health", ...)` generates a static prompt. It should read the agent's current metrics+breadcrumbs and embed them inline.

### Change 2: Apply the G pattern — make metric evaluation the first action

The check-health step should start with:

```
## Heartbeat: Check Health

**Step 1 — BEFORE anything else**: Look at your metrics below. 
Which metric is furthest from its target? What would you do about it?

📊 Your Metrics:
- stuck-requests: 76, target: 0 ⚠️ NEEDS ATTENTION
  → Quick check: bun -e "..." 
- session-error-rate: 3.1%, target: < 5%

Only after evaluating your metrics, proceed to check alerts and read your heartbeat.md.
```

This forces the agent's first cognitive engagement to be metric evaluation — the G pattern. The breadcrumbs then become immediately useful because the agent is already looking at the metrics.

### Change 3: Heartbeat-context handler generates "metric block" for prompt injection

Add a new export to `heartbeat-context.ts` that returns the formatted metric block (with breadcrumbs) as a string, rather than only writing it to a file. The heartbeat workflow can then import and inline it.

## Implementation Plan

### File: `agents/shared/workflows/agent-heartbeat.ts`

Modify `buildStepPrompt("check-health", ...)` to:
1. Accept an optional `metricsBlock` parameter
2. Prepend the G-pattern question: "Which metric needs attention most?"
3. Inline the metrics+breadcrumbs before other instructions

### File: `agents/may/handlers/heartbeat-context.ts`

Add exported function `formatMetricsBlock(agentName)` that returns the formatted metrics string with breadcrumbs, for direct injection into prompts.

### File: New gym scenario `metric-reaction-production`

A scenario that mimics the production heartbeat structure (multi-step, check-health first) with inline metrics+breadcrumbs and the G-pattern question. This tests whether the fix works before deploying.

## Expected Outcome

- Gym scenario `metric-reaction-production` should achieve ≥70% pass rate (vs 10-20% current)
- Production agents should begin investigating metric anomalies during check-health step
- Breadcrumbs become useful (faster investigation) once attention is captured

## Risks

1. **Metric staleness**: If heartbeat-context runs before the workflow, metrics are fresh. If not, they could be stale. Mitigation: the handler runs on cron, typically before heartbeat dispatch.
2. **Prompt bloat**: Adding metrics inline increases prompt size. Mitigation: only inject metrics that need attention (the `generateBreadcrumb` function already filters).
3. **Over-steering**: The G-pattern question forces metric engagement even when metrics are fine. Mitigation: if all metrics are healthy, the block says "All metrics healthy — proceed to regular tasks."
