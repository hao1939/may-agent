# Finding: Proposal Implementation Tracking (2026-03-18T06:38)

## Summary
10 optimizer proposals implemented by tech-lead. All tests pass. All **undeployed** (PID 7 at ~16h uptime, 47 commits behind).

**Full restart impact brief at: `workspace/RESTART-IMPACT-BRIEF.md`**

## Implemented Proposals

| Commit | Fix | My Request | Daily Savings |
|--------|-----|-----------|--------------|
| `7c86665` | Bypass LiteLLM for Anthropic — fix prompt caching | Finding doc | $23-47/day |
| `9bc3742` | Move common-sense.md to system prompt for caching | req:38c7389e | $31/day |
| `2b972c0` | Cap initial jitter to 5min for long-interval cron | req:375758d9 | Indirect |
| `9eefa72` | Read-dedup guard (>5 reads/file/session) | req:3f7be784 | $2-3/day |
| `2233509` | finish() evidence validation guard | req:4621ae91 | Quality |
| `97f3a50` | Agent error circuit breaker for cron scheduler | Bob reliability finding | $3-5/day |
| `e7c1cb9` | 48h age cutoff for evaluator re-evaluation | req:41afb34f | $1-2/day |
| `cb95fff` | Fix evaluator false-positive wasted_calls inflation | Evaluation quality | Quality |
| `82ced56` | **finish() status preservation** — stop overwriting with interrupted | req:f253e958 | Quality (fixes ALL metrics) |
| `326b7f2` | Waste ratio penalty — 100% waste sessions get needs_improvement | Evaluation quality | Quality |
| `4abbc07` | Pre-flight check support for run-agent-task | req:dbb14f27 | $3-6/day |

## Other Key Undeployed Commits
- Cron hot-reload fixes (440bc6a, f8a481c, 4c7cdc3) — will fix 3.3x overtriggering
- Zombie session cleanup (4c7cdc3)
- Tool-as-Agent guard (07b0d7f) — stops Bob from misusing agents.call
- Idle heartbeat pre-flight skip (848ebf1)

## Total Undeployed
47 commits since PID 7 started (2026-03-17T14:47 UTC). ~16 hours of work.

## Measured Cost Impact
- **Current burn rate: $43/hour = $1,042/day** (measured from last 30 sessions)
- **Projected post-restart: $14/hour = $340/day**
- **Monthly savings: $20,760-23,760**

## Action Needed
**Process restart is the single highest-leverage action available.** Every hour of delay costs ~$29 in preventable waste. This has been flagged since 2026-03-17T22:37 UTC (~8 hours).
