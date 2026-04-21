# Context Injection Principle: Breadcrumbs, Not Answers

**ID:** KE-311
**Source:** Hao (2026-04-20, via May P0 directive — "most important finding for the system")
**Category:** architecture-principle
**Tags:** context-injection, agent-behavior, breadcrumbs, action-triggering
**See also:** [KE-context-discovery-chain.md](./KE-context-discovery-chain.md) (full experimental data)

## The Principle

When injecting context to make agents act, provide **breadcrumbs to investigate**, not answers to implement.

## Why

Three phases were tested via controlled LLM API experiments:

| Phase | Injection style | Agent response |
|-------|----------------|----------------|
| **Show metric** | "stuck-requests: 76" | Acknowledges, doesn't act |
| **Give answer** | "Here are the 5 stale requests to fix" | Logs/plans, doesn't fix |
| **Give breadcrumb** | "Something odd in file X, line Y" | Investigates and fixes |

## Implications for System Design

1. **Heartbeat context**: Don't inject "here's what's wrong and how to fix it." Inject "here's an anomaly worth investigating" with a pointer to where to look.
2. **Directives**: Frame as investigation prompts, not action commands.
3. **Metric alerts**: Include the query to run, not the query results.
4. **Knowledge entries**: Reference where to look, not what to conclude.

## The Chain (from KE-context-discovery-chain)
```
Signal (metric shows problem)
  → Breadcrumb (here's how to investigate: run this query / check this file)
    → Agent investigates (runs query, reads file)
      → Agent discovers the problem themselves
        → Agent acts (because they own the discovery)
```

## Anti-patterns
- ❌ "Fix these 5 stale requests: [list]" → agent acknowledges but doesn't act
- ❌ "stuck-requests metric is 76, please reduce it" → agent talks about it
- ✅ "stuck-requests is 76. Run `query requests WHERE status=CREATED AND age > 48h` to see what's stuck" → agent investigates and fixes
