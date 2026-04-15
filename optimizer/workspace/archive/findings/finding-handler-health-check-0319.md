# Finding: Handler Health Check — 2026-03-19T02:49 UTC

## Status: HEALTHY (handlers fine, but #1 cost issue persists)

## System State
- **Process restarted** ~54 min ago (seq reset 201→0 at 2026-03-19T01:55 UTC)
- **Session success rate**: 95% (38/40 done, 2 interrupted)
- **Memory-trimmer handler**: Committed (bba832c) + cron entry registered. Will fire on 24h interval after restart — pending first execution. 84MB memory still present (62MB orphans).
- **All handlers registered**: 38 cron entries, handlers discovered at startup.

## Critical Finding: Opus Prompt Caching Still Broken Post-Restart

| Metric | Value |
|--------|-------|
| Last 10 evaluated sessions total cost | $22.97 |
| Opus agents (0% cache) share | $21.67 (94%) |
| Cached providers (bob/qa/amy-kimi) share | $1.30 (6%) |
| Projected daily cost at 100 sessions/day | ~$230/day |
| Projected savings with cache fix | ~$156/day (~$4,700/month) |

### Why it's still broken
- Code deployed (commit 7c86665) but **requires `ANTHROPIC_API_KEY` env var**
- Without it, all Opus calls go through LiteLLM proxy which strips `cache_control` fields
- Post-restart sessions confirm: tech-lead, optimizer, amy all still 0% cache read

### Cost per agent (recent sample)
| Agent | Sessions | Total Cost | Cache % | Avg/Session |
|-------|----------|-----------|---------|-------------|
| tech-lead | 4 | $16.40 | 0% | $4.10 |
| optimizer | 2 | $7.90 | 0% | $3.95 |
| amy | 2 | $5.86 | 0% | $2.93 |
| coach | 2 | $2.83 | 0% | $1.42 |
| bob | 2 | $0.94 | 62% | $0.47 |
| amy-kimi | 1 | $0.47 | 89% | $0.47 |
| qa | 2 | $0.59 | 75% | $0.30 |
| may | 4 | $0.39 | 0% | $0.10 |

### Blocker
**Hao must set `ANTHROPIC_API_KEY` in the container environment.** This is a ~10 second config change that saves $4,700/month.

## Previous Escalations
- Finding at `workspace/finding-prompt-caching-broken-opus.md` (2026-03-18)
- Sent to tech-lead (req:6bfd83d4)
- Noted in daily brief
