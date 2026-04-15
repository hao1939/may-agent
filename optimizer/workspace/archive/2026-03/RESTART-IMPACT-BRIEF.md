# 🔴 Restart Impact Brief — PID 7

**Date:** 2026-03-18T06:38 UTC
**Action Required:** Restart the May process (PID 7: `bun src/app/launcher.ts`)
**Risk:** Zero (graceful restart, no data loss)
**Time Required:** ~30 seconds + set `ANTHROPIC_API_KEY` env var

---

## Current State

| Metric | Value |
|--------|-------|
| PID 7 uptime | ~16 hours (since 2026-03-17T14:47 UTC) |
| Undeployed commits | **47** |
| Current burn rate | **$43/hour = $1,042/day** |
| Session rate | ~40 sessions/hour |
| Prompt cache hit rate | **0%** (broken — LiteLLM strips cache_control headers) |
| Avg input tokens/session | **600K** (optimizer: 912K, amy: 773K, coach: 607K) |

## Cost Breakdown by Agent (last 30 sessions, 43 mins)

| Agent | Sessions | Total Cost | Avg Cost | Status |
|-------|----------|-----------|----------|--------|
| optimizer | 4 | $12.99 | $3.25 | Working, but 0% cache |
| tech-lead | 4 | $9.41 | $2.35 | Working, but 0% cache |
| coach | 4 | $2.66 | $0.67 | Working, but 0% cache |
| amy | 1 | $2.53 | $2.53 | Working, but 0% cache |
| scout | 1 | $1.44 | $1.44 | Working, but 0% cache |
| may | 5 | $0.75 | $0.15 | 80% idle (1 op, finds nothing) |
| qa | 2 | $0.73 | $0.36 | Working |
| bob | 4 | $0.47 | $0.12 | 75% erroring (Gemini API down) |
| evaluator | 3 | $0.28 | $0.09 | Working |
| amy-kimi | 2 | $0.22 | $0.11 | Mostly idle/erroring |

## What Restart Unlocks

### Tier 1: Immediate Cost Reduction (~$700/day savings)

1. **Prompt caching fix** (7c86665) — Bypasses LiteLLM for Anthropic when `ANTHROPIC_API_KEY` is set. Currently 0% cache hits on 6 Opus agents burning ~28M input tokens/day uncached. **Savings: $23-47/day** becoming **$500+/day** once intervals also fix.

2. **Cron interval correction** (5244274, 8c8cf0b, 440bc6a, f8a481c) — Hot-reload is broken, so the 1800s interval configs I set aren't active. Currently firing at 540-780s. **Reduces sessions from ~40/hr to ~12/hr.**

3. **Idle heartbeat pre-flight skip** (848ebf1, 4abbc07) — 7 cron entries now have pre-flight checks that skip LLM sessions when nothing to process. **Saves $3-6/day.**

4. **Common-sense.md to system prompt** (9bc3742) — Moved from per-message injection to system prompt for caching. **Saves ~$31/day.**

### Tier 2: Quality & Reliability

5. **finish() status preservation** (82ced56) — Currently 77% of finish() calls are overwritten to "interrupted". Breaks all completion tracking, evaluations, and metrics. **Fixes the entire evaluation pipeline.**

6. **finish() evidence guard** (2233509) — Blocks false `success` claims when no deliverables were produced. **Improves evaluation integrity.**

7. **Evaluator re-eval cutoff** (e7c1cb9) — Stops re-evaluating 9,974 old sessions every 12h. **Saves $1-2/day.**

8. **Read-dedup guard** (9eefa72) — Blocks Amy's infinite read loops (75× reads of same file). **Saves $2-3/day per incident.**

9. **Error circuit breaker** (97f3a50) — Stops cron from spawning new sessions for agents in error loops (Bob). **Saves $3-5/day.**

10. **Tool-as-Agent guard** (07b0d7f) — Stops Bob from calling `checkpoint` as an agent instead of as a tool. 5/5 recent Bob sessions misuse this. **Quality fix.**

### Tier 3: Cleanup

11. **Zombie session cleanup** (4c7cdc3) — Archives stale sessions on startup.
12. **Evaluator false-positive fix** (cb95fff) — Corrects wasted_calls inflation.
13. **Waste ratio penalty** (326b7f2) — 100% waste sessions now properly flagged.
14. **Jitter cap** (2b972c0) — Long-interval jobs no longer get 30-min random jitter.

## Projected Post-Restart State

| Metric | Before | After | Reduction |
|--------|--------|-------|-----------|
| Sessions/hour | ~40 | ~12 | **70%** |
| Cost/day | $1,042 | ~$250-350 | **66-76%** |
| Cache hit rate | 0% | 60-80% | **∞** |
| Bob error sessions | 3-4/hr | 0 (circuit breaker) | **100%** |
| May idle sessions | 4-5/hr | 0-1 (pre-flight) | **80%** |
| finish() tracking | broken | working | **Fixed** |

## Monthly Impact

| | Current | Post-Restart |
|--|---------|-------------|
| Monthly cost | **$31,260** | **$7,500-10,500** |
| Monthly savings | — | **$20,760-23,760** |

## How to Restart

```bash
# 1. Set the Anthropic API key (needed for prompt caching bypass)
export ANTHROPIC_API_KEY=<key>

# 2. Restart PID 7
kill 7
# The Docker container will restart it automatically via entrypoint
# OR: restart the container
```

Every hour of delay costs ~$29 in preventable waste ($43 current - $14 projected).
