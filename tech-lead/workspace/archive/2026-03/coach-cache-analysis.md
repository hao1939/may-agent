# Coach Cost Crisis — Tech Lead Analysis

**Date:** 2026-03-17T21:01 | **Request:** req:3e6b33b0

## Findings
1. Bob uses Gemini (gemini3pro) — cache hits are Gemini implicit caching, not comparable to Anthropic
2. Application code already requests Anthropic caching correctly (pi-ai cache_control: ephemeral)
3. LiteLLM proxy (host.docker.internal:4000) likely strips cache_control markers — infra config issue
4. Coach evaluation data unreliable — heuristic evaluator sets all usage to 0

## Actions
- Sent analysis to optimizer (agents.send)
- LiteLLM proxy config check needed (Hao/ops)
- Heuristic evaluator usage fix needed (code task)
- Gym frequency reduction recommended (config)
