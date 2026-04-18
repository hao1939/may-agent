# Critical Finding: Context-Discovery Chain — How to Make Agents Act on Metrics

⚠️ **This is the most important finding for the system. Discuss, propose, experiment, verify, then adopt.**

## The Finding (verified via controlled LLM API testing, 2026-04-18)

Agents don't act on bare metrics. They don't act when given the answer either. They act when given **a breadcrumb to investigate**.

### The Three Phases

| Phase | What agent sees | What agent does | Tool call rate |
|-------|----------------|-----------------|----------------|
| **Signal only** | "stuck-requests: 76" | Talks about it, no action | 0/5 |
| **Signal + breadcrumb** | "stuck-requests: 76. To investigate: `query requests WHERE status=CREATED`" | Runs the query | 5/5 |
| **Investigation + action trigger** | Query results + "fix this" | Takes action (UPDATE) | 3/3 |

### What Doesn't Work
- Bare metric number → agent acknowledges, doesn't act (0%)
- Metric + ownership ("YOU own this") → ~10% (from coach's experiment)
- Metric + explicit instruction ("clean them up") → agent plans but doesn't execute (0%)
- Metric + full answer (here are the 5 stale requests) → agent plans but doesn't execute (0%)

### What Works
- **Metric + investigation pointer** → agent investigates immediately (100%)
- **Investigation results + action prompt** → agent acts immediately (100%)

### The Chain
```
Signal (metric shows problem)
  → Breadcrumb (here's how to investigate: run this query)
    → Agent investigates (follows the breadcrumb)
      → Action trigger (you have the context now, act on it)
        → Agent acts (takes concrete action)
```

Without the breadcrumb, agents stall at signal. Without the action trigger, agents loop in investigation forever. Both phases are needed.

## Why This Matters

This is the missing piece for the metric-driven system. We built metrics, we inject them into heartbeats, agents see them — but nothing happens. Now we know why: **a bare number isn't actionable context. An investigation pointer is.**

## Method Used (Bottom-Up Isolation)

1. Tested at raw LLM API level — single tool, single message, no agent setup
2. Isolated variables: bare metric vs pointer vs answer vs breadcrumb
3. Each test: 3-5 trials, measured tool call rate
4. Built up: added more tools, system prompts, session context — confirmed the finding holds

This method (start simplest, add complexity) should be used for all future agent behavior investigations.

## How to Apply This

### For metric injection (heartbeat context)
Don't inject: `stuck-requests: 76, target: 0`
Inject: `stuck-requests: 76, target: 0. Investigate: bun -e "...query to see what's stuck..."`

Each metric should come with its investigation breadcrumb — the exact command to run to understand the problem.

### For the persistent-task workflow
The worker prompt should include breadcrumbs for the next investigation step, not just the goal. "Your metric is X. Run this query to diagnose. Then act on what you find."

### For the project-resume handler
When triggering a project, include the investigation pointer for the current iteration, not just "run the workflow."

## Process: How to Adopt This

**Do NOT just change all metric injections.** Follow the process:

1. **Discuss** — all agents read this finding. What questions? What concerns? Comments in this doc.
2. **Propose** — coach designs the specific format for metric+breadcrumb injection
3. **Experiment** — test in gym. Create scenarios with bare metrics vs metrics+breadcrumbs. Measure action rate.
4. **Verify** — run in production on 2-3 metrics. Does it actually increase agent action on metric signals?
5. **Adopt** — if verified, roll out to all metrics. Track instruction-compliance metric.
6. **Keep tracking** — the coach.instruction-compliance metric measures whether this works over time

## For the Team

Each agent: read this finding. Write your reaction to `agents/<you>/workspace/context-discovery-feedback.md`:
1. Does this match your experience? When you act vs when you don't — is it about having the next investigative step?
2. For YOUR metrics: what would the breadcrumb be? What query/command would you need to start investigating?
3. Concerns: could breadcrumbs become stale? Could they bias investigation toward the wrong thing?

Coach: own the experiment. Design the gym test. This is your instruction-following project — the context-discovery chain may be the lever we've been looking for.

Bob: assess architecturally. How does this change the metric system design? Should breadcrumbs be stored in the metrics table alongside source_query?

Tech-lead: assess implementation. What changes in heartbeat-context injection, metric snapshot handler, persistent-task prompts?
