# Finding: Process Restart Impact — Fresh Measurement

**Date**: 2026-03-18T07:19Z  
**Severity**: CRITICAL  
**Status**: Blocked on Hao action (container restart)

## Summary

PID 7 has been running since Mar 17. 51+ commits are undeployed. Fresh measurement shows 5 of 10 agents still firing heartbeats at 2.5-3× the configured rate.

## Fresh Interval Measurements (last 3 hours)

| Agent | Actual Interval | Configured | Over-fire Factor |
|-------|----------------|------------|-----------------|
| bob | 660s (11min) | 1800s | 2.73× |
| coach | 720s (12min) | 1800s | 2.50× |
| may | 602s (10min) | 1800s | 2.99× |
| optimizer | 604s (10min) | 1800s | 2.98× |
| tech-lead | 724s (12min) | 1800s | 2.49× |
| amy | 1801s ✅ | 1800s | 1.00× |
| amy-kimi | 1801s ✅ | 1800s | 1.00× |
| qa | 1800s ✅ | 1800s | 1.00× |
| scout | 1801s ✅ | 1800s | 1.00× |
| evaluator | 7200s ✅ | 7200s | 1.00× |

**Note**: Amy, amy-kimi, qa, scout were already at correct intervals at process start. The 5 broken agents had shorter intervals in the old config that PID 7 loaded.

## Cost of Not Restarting

- **Excess sessions**: 17.36/hr (from 5 over-firing agents)
- **At ~$0.20/session**: $83.33/day wasted on excess heartbeats alone
- **Prompt caching broken**: Additional $23-47/day (ANTHROPIC_API_KEY bypass not deployed)
- **Total waste**: ~$106-130/day ($3,180-3,900/month)

## 11 Fixes Blocked on Restart

1. **Cron interval reload** (440bc6a, f8a481c, 4c7cdc3) — $83/day savings
2. **Prompt caching bypass** (7c86665) — $23-47/day savings
3. **Tool-as-agent guard** (07b0d7f) — blocks Bob checkpoint/finish misuse
4. **Read-dedup guard** (9eefa72) — blocks Amy read loops
5. **Bob circuit breaker** (97f3a50) — stops 20+ consecutive error cascades
6. **Finish status fix** (82ced56) — 77% of completions currently mis-tracked
7. **Evaluator re-eval loop fix** (e7c1cb9) — prevents infinite re-evaluation
8. **Finish evidence guard** (2233509) — blocks false success claims
9. **Pre-flight checks** (4abbc07) — skip idle LLM sessions at handler level
10. **Waste ratio penalty** (326b7f2) — evaluator detects 100% waste sessions
11. **Common-sense prompt caching** (9bc3742) — moves injection to system prompt

All 1,457 tests pass. All commits are on main.

## Action Required

Container restart or `kill -HUP 7`. No code changes needed — everything is committed and tested.
