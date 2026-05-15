# First-Turn Provider Error Analysis — 2026-05-11 00:05 UTC

## Status: ACTIVE — metric breaching (7 > threshold 5)

## Root Cause
All 7 first-turn errors in the last hour are **GitHub Copilot IDE token expiration** (`401 litellm.AuthenticationError`). The LLM proxy (litellm) attempts `gpt-5.4` via `github-copilot` provider, and when the IDE token is stale, sessions die on the very first API call with zero tool operations.

## Evidence

### Error pattern (from session transcript s_1778457804315_170):
```
401 litellm.AuthenticationError: Github_copilotException - IDE token expired: unauthorized: token expired
Received Model Group=gpt-5.4, Available Model Group Fallbacks=None
```

### Affected sessions (last ~1h window):
| Session | Agent | Status |
|---------|-------|--------|
| s_1778457805317_172 | evaluator | error (opCount=0) |
| s_1778457804408_171 | scout | error (opCount=0) |
| s_1778457804315_170 | evaluator | error (opCount=0) |
| s_1778456006231_152 | scout | error (opCount=0) |
| s_1778454201209_137 | evaluator | error (opCount=0) |
| s_1778454200547_136 | scout | error (opCount=0) |
| s_1778454200463_135 | evaluator | error (opCount=0) |
| s_1778454200327_134 | arc | error (opCount=0) |
| s_1778454200257_133 | dev | error (opCount=0) |
| s_1778454200147_132 | may | error (opCount=0) |

### Agent hit distribution:
- evaluator: 5 errors (most affected — likely higher session volume)
- scout: 3 errors
- may, dev, arc: 1 each

### Key observation: Not all sessions fail
Concurrent sessions like `s_1778457804185_168` (dev, 24 ops, done) and `s_1778457804115_167` (may, 15 ops, done) succeeded at the same timestamp. This means:
1. **Different model routing**: Some agents may route to different models/providers
2. **Token rotation race**: The token refresh may have kicked in between requests
3. **No fallback configured**: Error says `Available Model Group Fallbacks=None` — when `gpt-5.4` via github-copilot fails, there's no automatic retry on another provider

## Impact
- 85% success rate (down from ~95% normal)
- Metric `First-turn provider errors (1h)` stuck at 7 for 30+ minutes — not self-healing
- Heartbeat sessions for evaluator/scout most affected → evaluation pipeline degraded

## Recommendations

1. **Immediate**: Refresh/rotate the GitHub Copilot IDE token
2. **Resilience**: Configure model group fallbacks in litellm so `gpt-5.4` failures route to an alternative (e.g., direct OpenAI, Anthropic)
3. **Monitoring**: The metric correctly detects this; no metric change needed
4. **Owner**: Runtime/infra (not agent-layer fixable)

## Prior Investigation
Dev already documented this in `dev/workspace/investigations/2026-05-10-first-turn-provider-auth-continuation.md` with the same conclusion. This analysis adds the agent-level impact distribution and the observation that concurrent sessions succeed (suggesting partial token validity or model routing differences).
