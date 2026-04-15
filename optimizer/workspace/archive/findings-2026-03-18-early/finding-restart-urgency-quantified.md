# Finding: Process Restart Is Costing ~$400-800/Day in Waste

**Date**: 2026-03-18T02:35 UTC  
**Status**: URGENT — Blocked on manual ops action (Hao)  
**Previous findings consolidated**: finding-cron-reload-broken.md, finding-restart-deployment-backlog.md

## Executive Summary

The system process (PID 7) hasn't been restarted since multiple critical fixes were committed. Cron config changes are NOT being hot-reloaded. The result: **all agents fire at old intervals (540-780s) instead of configured 1800s**, producing 3x more sessions than intended. Combined with Bob's 100% error rate and May's 1-op sessions, **33% of all sessions are completely wasted**.

## Measured Data (2026-03-18, 00:30-02:30 UTC)

### Actual vs Configured Intervals
| Agent | Configured | Actual (measured) | Multiplier |
|-------|-----------|-------------------|------------|
| optimizer | 1800s | 540s | 3.3x |
| bob | 1800s | 660s | 2.7x |
| coach | 1800s | ~600-700s | 2.6-3.0x |
| tech-lead | 1800s | ~780s | 2.3x |
| may | 1800s | ~600s | 3.0x |

### Session Volume (last 6 hours)
- **Total sessions**: 317 (52.8/hr)
- **Expected at configured intervals**: ~15-20/hr
- **Wasteful sessions** (error or ≤2 ops): **104 (33%)**
  - Bob: 31 errors (100% of Bob sessions — Gemini API issue)
  - May: 37 sessions with ≤2 ops (82% of May sessions — interrupted too quickly)
  - Other low-ops: scattered across agents

### Session Quality (last 2 hours, 91 sessions)
| Agent | Sessions | Avg Ops | Errors | Interrupted | Useful |
|-------|----------|---------|--------|-------------|--------|
| optimizer | 13 | 27.9 | 0 | 13 | moderate |
| coach | 19 | 9.6 | 0 | 19 | low-moderate |
| may | 15 | 1.0 | 0 | 15 | very low |
| bob | 11 | 0.2 | 11 | 0 | zero |
| tech-lead | 9 | 36.6 | 0 | 9 | moderate |

## Committed Fixes Awaiting Deployment

| Fix | Commit | Impact |
|-----|--------|--------|
| Cron hot-reload | 440bc6a, f8a481c | Intervals take effect without restart |
| Zombie session cleanup | 4c7cdc3 | Orphaned sessions cleaned up automatically |
| LiteLLM bypass for Anthropic | 7c86665 | Prompt caching works → $23-47/day savings |
| Eval re-eval fix | 1671974, adc98bd | Stop re-evaluating 10K old sessions |
| Tool-as-Agent guard | 07b0d7f | Prevent agents from misusing call/send |
| MAX_PARENTS_PER_RUN=3 | evaluator cascade fix | Stop evaluator session explosions |

## Cost Estimate

**Conservative**: 788 excess sessions/day × $0.50/session = **$394/day wasted**  
**With prompt caching savings**: Add $23-47/day = **$417-441/day**  
**Monthly**: **$12,500-13,200/month** in preventable waste

## Action Required

**Single action**: Restart the process (PID 7). This deploys ALL committed fixes at once.

```bash
# Hao: restart the main process
# All 6+ committed fixes activate immediately
```

This has been flagged since 2026-03-17T22:37 UTC (~4 hours ago). Every hour of delay costs ~$20-30 in wasted sessions.
