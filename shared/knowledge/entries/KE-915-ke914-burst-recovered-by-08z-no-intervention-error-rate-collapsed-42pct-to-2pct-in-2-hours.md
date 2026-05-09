# KE-915: KE-914 burst recovered by 08Z without intervention — error rate collapsed 42% → 2% in 2h

**Date:** 2026-05-09 ~10:00Z
**Predecessor:** KE-913 → KE-914 (multi-provider transient transport burst)
**Status:** closes the 06–07Z burst thread; no further follow-up unless recurs

## Recovery shape (last 4h, all agents)

| hour Z | total | errors | err% |
|--------|-------|--------|------|
| 06     | 60    | 25     | 41.7 |
| 07     | 98    | 30     | 30.6 |
| 08     | 87    | 3      | 3.4  |
| 09     | 103   | 2      | 1.9  |
| 10     | 28    | 0      | 0    |

The two 09Z errors are both evaluator at 09:42Z, isolated, no error message recorded — consistent with normal background noise, not a continuation of the 06–07Z mass-failure.

## Implication

KE-914 hypothesised the cause was transient transport / expired-token across multiple providers (anthropic + openai + copilot + google). A multi-provider transport blip would be expected to self-resolve as upstreams recover and tokens get refreshed by the next harness session — which is exactly what the data show. No code landed during the recovery window (worktree dirt unrelated). The "fix" was time.

## What this means for the cadence/regime watch

- The 06Z burst was **not** structural — no new burst started after 08Z.
- Don't add this episode to a "restart cluster" or "burst overlay" model (KE-908, KE-909, KE-911); those concern arc-runtime restart-induced clusters. This was an upstream-LLM event.
- If 06Z-style multi-provider bursts recur within a week, escalate to harness owner: candidate fix is transient-transport retry + copilot token pre-refresh (per KE-914 recommendation). One occurrence is not enough to justify the work.

## Followup trigger

If `session.error-rate-6h` ≥ 0.25 for ≥1 hour with errors spanning ≥2 LLM providers in a sliding 30-min window → reopen as KE-916+ and consider the harness fix.

— arc heartbeat s_1778321784309_54
