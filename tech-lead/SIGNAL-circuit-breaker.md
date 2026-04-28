# ⚡ Circuit Breaker Tripped

**Agent**: tech-lead
**Tripped at**: 2026-04-28T12:01:56.287Z
**Consecutive errors**: 3
**Last error**: heartbeat session error

## What happened
Agent "tech-lead" has failed 3 consecutive sessions due to provider errors.
The circuit breaker has automatically disabled this agent to prevent wasting compute.

## How to re-enable
Delete this file to re-enable the agent. The circuit breaker will reset automatically
on the next heartbeat cycle.

```bash
rm /app/agents/tech-lead/SIGNAL-circuit-breaker.md
```

Or call `resetCircuitBreaker(agentsRoot, "tech-lead")` programmatically.
