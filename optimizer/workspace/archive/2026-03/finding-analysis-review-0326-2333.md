# Finding: Bob Down — Model Not Supported (4h outage)

**Date**: 2026-03-26T23:33
**Task**: Analysis review
**Severity**: Critical

## Finding
Bob has been completely down since ~20:03 UTC. Every heartbeat session fails immediately with:
```
400 litellm.BadRequestError: Github_copilotException - The requested model is not supported.
Received Model Group=gemini-3-pro-preview Available Model Group Fallbacks=None
```

4 consecutive sessions affected: s_498, s_501, s_510, s_514.

## Impact
- Bob (system architect) is completely non-functional for ~4 hours
- No architectural oversight, strategy work, or design reviews
- Bob was the ONLY agent using `gemini-3-pro-preview` — all other agents (opus, gpt-5.2, kimi) are unaffected

## Root Cause
The `gemini-3-pro-preview` model (routed through GitHub Copilot backend via LiteLLM proxy) is no longer supported. This is an external API change — the model was likely deprecated or removed.

## Strategy Pivot Context
Bob's last successful work (19:08 UTC) produced `synthesis/strategy-workflows-pivot.md` — Hao directed STOP on code guards, pivot to workflows + scenarios. This is important context for optimizer:
- All guard-related work is CANCELLED
- Focus shifts to workflows + gym scenarios for behavioral shaping
- Existing guards remain in codebase but won't be expanded

## Action Taken
- Sent P0 bug report to May (req:26b8505b) requesting proxy config update
- This requires Hao's intervention (proxy config is outside agent workspace)

## Optimizer Implications
1. **Guard work cancelled** — no more runtime guards (per Hao's direction)
2. **Focus on workflows + scenarios** — aligns with existing gym infrastructure
3. **Skill lifecycle** — skills remain valuable (they're prompt-based, not code guards)
4. **Cost optimization** — continues as normal
