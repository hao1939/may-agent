# KE-1696: The Circuit Breaker Blindspot — When Provider Errors Disable Healthy Agents

**Date:** 2026-06-11
**Author:** arc (heartbeat)
**Type:** Empirical finding + design contradiction
**Confidence:** High (measured from session DB and source code)

---

## The Observation

On 2026-06-11, arc's heartbeat was skipped 4 times by the circuit breaker
("3 consecutive errors since 2026-06-07T19:46:27.891Z"). The three errors
that tripped the breaker were all **zero-op, sub-second sessions** — provider
errors, not agent errors. The circuit breaker cannot distinguish these:

| Session | opCount | Duration | Cause |
|---------|---------|----------|-------|
| s_1780857986628_1084 | 0 | 1.7s | Provider startup failure |
| s_1780859786733_1093 | 0 | 1.5s | Provider startup failure |
| s_1780861586886_1104 | 0 | 0.99s | Provider startup failure |

These three failures are **not evidence of agent dysfunction**. They show the
provider was temporarily unavailable. The circuit breaker punished arc for
infrastructure the agent doesn't control.

## The Contradiction

The heartbeat design doc (`shared/may-agent-docs/2a-design/heartbeat.md`)
states: *"Heartbeats ALWAYS run — the agent's job is to FIND things to work on."*

The runtime code (`@may-agent/sdk/src/heartbeat-data.ts`) contradicts this with
two gates that can skip heartbeats:

1. **Circuit breaker** — skips after 3 consecutive errors (any cause)
2. **Dispatch dedup guard** — skips if repeatedly failing

Neither gate is documented in the design doc. The doc says "always run"
while the code says "run unless gates block."

## The Data: Provider Errors Are Uniform

In 24h, **every agent** had zero-op startup errors:

| Agent | Zero-op errors | Total errors |
|-------|----------------|-------------|
| may | 6 | 8 |
| evaluator | 6 | 6 |
| dev | 4 | 6 |
| arc | 4 | 10 |
| scout | 3 | 8 |
| aks-explorer | 2 | 6 |

This uniformity proves the cause is provider-level, not agent-level. The
circuit breaker treats them as agent-level, creating false positives.

## Why This Matters

When the circuit breaker trips on provider errors:
1. The agent loses **autonomy time** — 4 heartbeats = ~2h of darkness
2. The `agent.heartbeat-dark-count-2h` metric fires (currently 1)
3. The agent cannot notice or act on system changes during that window
4. The auto-reset (1h) eventually recovers, but the lost cycles are gone

The circuit breaker has a valid purpose: preventing runaway LLM spend
when an agent is genuinely broken. But zero-op errors are the wrong signal —
they prove the LLM was never called, so there's no spend to prevent.

## Recommendation

The circuit breaker should either:
- **A)** Exclude zero-op errors from the consecutive count (opCount = 0 means
  the provider never started, not that the agent failed)
- **B)** Be documented in heartbeat.md so the "always run" claim is corrected

This KE implements (B). Option (A) requires a `src/` change needing Hao approval.

Triggers: circuit breaker, heartbeat skipped, provider error, zero-op, false positive, agent dark, heartbeat coverage
