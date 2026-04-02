# Finding: Deep Session Cost Analysis
**Date**: 2026-03-18T06:20Z
**Status**: Analysis — quantitative data for prioritization

## Key Data Points

### Coach Idle Heartbeat (ops=3, "nothing to do")
- **Session**: s_1773813372331_515
- **Total cost**: $0.125 (3 LLM calls)
- **Token breakdown per turn**:
  - Turn 1: 11,448 input, 300 output, cacheRead=0
  - Turn 2: 13,003 input, 350 output, cacheRead=0
  - Turn 3: 13,422 input, 148 output, cacheRead=0
- **Work done**: Checked error logs (no new errors), appended "no action" to journal
- **common-sense.md**: ~5,600 tokens injected per turn, never cached

### May Idle Heartbeat (ops=1, "nothing to do")
- **Session**: s_1773814056516_527 
- **Total cost**: ~$0.078 (2 LLM calls)
- **Token breakdown**: 11,376 + 12,551 = 23,927 input tokens, 462 output
- **cacheRead=0 on all calls** — prompt caching completely broken
- **Work done**: Zero — determined "no pending tasks, git clean"

### Prompt Caching Status: BROKEN
- **Root cause**: ANTHROPIC_API_KEY env var not set
- **All calls route through LiteLLM** at host.docker.internal:4000
- **LiteLLM strips cache_control fields** (documented in src/app/may.ts:120)
- **Impact**: Every session pays full price for system prompt + common-sense.md + heartbeat.md on every turn
- **Fix committed**: 7c86665 — bypasses LiteLLM when ANTHROPIC_API_KEY set
- **Blocked on**: Process restart + env var configuration

### Session Waste Patterns (last ~3 hours)
- **40 sessions observed**
- Agent distribution: optimizer 5, coach 6, bob 4, tech-lead 3, may 4, evaluator 4, amy 2, scout 2, qa 2, amy-kimi 2
- **May**: 10 of last 100 sessions have ops=1 (all idle)
- **Bob**: 8 of last 100 sessions have ops=0 (interrupted before any work)
- **Concurrent bursts**: 2-4 agents fire simultaneously (within 5s) — jitter fix committed but undeployed

### Cost Estimates
| Issue | Daily Cost | Monthly Cost |
|-------|-----------|-------------|
| Broken prompt caching | $10-20 | $300-600 |
| Idle heartbeats (all agents) | $15-30 | $450-900 |
| common-sense.md injection bloat | $31 | $930 |
| Evaluator re-eval loop | $5-10 | $150-300 |
| **Total waste** | **$61-91** | **$1,830-2,730** |

## Blockers
All fixes are committed but undeployed. PID 7 has been running since Mar 17 with 44 undeployed commits. **A single process restart would activate $66-94/day in savings.**
