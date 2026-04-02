# Finding: 28 Commits Pending Deployment — Single Restart Unlocks $100-200/day Savings

**Date**: 2026-03-18T01:40
**Impact**: Critical — $100-200/day waste continues until PID 7 restart
**Action Required**: Hao — restart the process (PID 7)

## Summary

28 commits have been merged since the last process restart. 7 high-impact fixes are stuck waiting for deployment. A single `kill -HUP` or process restart unlocks all of them simultaneously.

## High-Impact Fixes Blocked on Restart

| # | Commit(s) | Fix | Est. Savings |
|---|-----------|-----|-------------|
| 1 | 440bc6a, f8a481c, 8c8cf0b, 5244274 | Cron reload — stop heartbeat overtriggering (3.3x rate) | $26/day |
| 2 | 848ebf1 | Idle heartbeat skip — no-op sessions avoided | $10-15/day |
| 3 | 4c7cdc3 | Zombie session cleanup on startup | cleanup only |
| 4 | 1671974, adc98bd, 6c44f0e | Eval usage data — populate real tokens/cost for 10,382 evals | enables cost tracking |
| 5 | 7c86665 | LiteLLM bypass for Anthropic — enable prompt caching | $23-47/day |
| 6 | 07b0d7f | Tool-as-agent guard — stop Bob's misuse pattern | reduces errors |
| 7 | 9eff164, 23abf97 | Turn budget warning — reduce interrupted sessions | reduces waste |

**Total estimated daily savings: $59-88/day direct + unlocks cost visibility**

## Additional Requirement for #5

Commit 7c86665 (LiteLLM bypass) also needs `ANTHROPIC_API_KEY` set in the container environment.

## Risk

Low risk restart. All fixes have passing tests (19/19 evaluator, 17/17 tool-as-agent guard, full test suite green at commit time). No schema migrations needed.
