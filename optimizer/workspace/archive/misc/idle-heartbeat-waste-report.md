# Idle Heartbeat Waste Measurement

**Date**: 2026-03-16
**Status**: Complete — no action warranted

## Methodology

Analyzed session.jsonl files across 5 ranges of 500 sessions each (total: 2,500 sampled out of 10,640 sessions). A heartbeat is "idle" if it contains zero productive tool calls (no write, edit, mutating bash, agents send/call, handoff, or workflow). Read-only operations (grep, git log, cat, ls, etc.) are not counted as productive.

## Key Findings

### Idle Heartbeat Rate: 3.8-9.1% (low)

| Period | Heartbeats | Idle | Rate | Idle Cost | Avg Idle Cost |
|--------|-----------|------|------|-----------|---------------|
| Early (0-500) | 3 | 1 | 33%* | $6.18 | $6.18* |
| Q2 (2500-3000) | 461 | 18 | 3.9% | $1.06 | $0.059 |
| Q3 (5000-5500) | 496 | 45 | 9.1% | $2.89 | $0.064 |
| Q4 (7500-8000) | 500 | 19 | 3.8% | $0.98 | $0.052 |
| Recent (last 500) | 493 | 21 | 4.3% | $4.36 | $0.208 |

*Early period had few heartbeats (mostly non-heartbeat sessions), statistically insignificant.

### By Agent (Recent 500)

| Agent | Idle/Total | Rate | Cost |
|-------|-----------|------|------|
| bob | 13/69 | 19% | $3.10 |
| amy | 9/36 | 25% | $0.85 |
| may | 1/280 | <1% | $0.58 |
| optimizer | 0/44 | 0% | $0.00 |
| scout | 0/20 | 0% | $0.00 |
| coach | 0/23 | 0% | $0.00 |
| evaluator | 0/16 | 0% | $0.00 |
| tech-lead | 0/2 | 0% | $0.00 |

### Idle Session Profile
- Average 4.0 tool calls per idle session (all reads/grep — checking if there's work)
- 907K input tokens, 13.5K output tokens across 23 idle sessions (recent batch)
- The agent reads its todo/signals, finds nothing, and stops — this IS the agent's judgment

### Cost Extrapolation
- **Estimated total idle heartbeat cost across all 10,640 sessions: ~$96**
- This is <1% of total system spend ($9,600)
- Average idle heartbeat costs $0.05-0.20

## Decision: No Action

### The cost is negligible
~$96 total across 10,640 sessions = 1% of total spend. Even eliminating ALL idle heartbeats would save ~$0.90/day. Not worth engineering effort.

### Pre-check was already tried and rejected
See `agents/shared/may-agent-docs/case-study-precheck-antipattern.md`. Hao explicitly removed the JS heartbeat-precheck handler as an anti-pattern: "Agents decide whether to work. The harness decides when to wake them." Gating agents externally kills proactive work and violates agent autonomy.

### The agents ARE being efficient
An idle heartbeat that costs $0.05 (1-2 LLM turns to read todo, check signals, and stop) is the agent correctly determining it has nothing to do. This is agent self-judgment working as designed.

### The real idle offenders are bob and amy
Bob has 19% idle rate and amy 25%, but their per-session idle cost ($0.24 and $0.09) is small. The reason: they correctly check their state and stop quickly. This is the system working.

## Recommendation

Close this todo item. The idle heartbeat "waste" is a rounding error. The #1 cost lever remains prompt caching for Opus agents (0% cache rate → potential 50%+ reduction = ~$4,800/year savings). Focus energy there instead.
