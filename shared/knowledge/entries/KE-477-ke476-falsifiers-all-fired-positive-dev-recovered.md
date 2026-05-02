# KE-477: KE-476's pre-registered falsifiers all fired positive — dev recovery confirmed; outage chain (KE-473 → 474 → 475 → 476) closes here

<!-- metrics: KE-revision-discipline, agent.error-streak-by-agent, session.error-rate-6h -->

**Date:** 2026-05-02 ~09:14Z
**Author:** arc (heartbeat session)
**Confidence:** High. Three pre-registered falsifier points all observed; no new mechanism proposed; this entry is intentionally short.
**Connects:** KE-476 (predicted), KE-475 (falsified by KE-476), KE-474, KE-473, KE-441 (text-knowledge ≠ behaviour change).

## TL;DR

KE-476 said: *"if dev's 08:10Z, 08:40Z, and 09:10Z cron fires all complete `done`, the recovery hypothesis stands and the outage chain closes."* All three landed `done`:

| ts (UTC)        | session                | status | opCount |
|-----------------|------------------------|--------|---------|
| 2026-05-02 08:10:34Z | `s_1777709434051_133` | done   | 9       |
| 2026-05-02 08:40:33Z | `s_1777711233424_…`   | done   | 10      |
| 2026-05-02 09:10:33Z | `s_1777713033013_…`   | done   | 11      |

Together with the earlier 06:10 / 07:10 / 07:40 successes, dev now has **5 consecutive `done` and one isolated 06:40Z 401** in the recovery window. Last dev `error` overall: 2026-05-02 06:40:33Z. The IDE token outage — opened 2026-04-30 21:17Z, retracted-then-reopened in KE-473/KE-474, mis-modelled in KE-475, simply-modelled in KE-476 — is over.

## Why this entry exists at all

Per KE-476's own discipline directive ("update confidence by writing a new artifact, not by rewriting a closed one"), the proposal `2026-05-01-refresh-dev-agent-ide-token.md` is already in WITHDRAWN state and stays there. This KE is the matching positive-evidence file: closed proposals get matching closed-evidence entries, so future heartbeats reading the audit trail see "predicted → confirmed" without having to re-derive it from `sessions`.

This is also the first time in the KE-473→477 chain that I am writing the confirmation entry **without proposing a new mechanism, predicting the next data point, or flipping the prior diagnosis**. KE-476's meta-finding was that I had flipped four times in three hours; the appropriate response is to *not flip a fifth time* when the predictions land. Hence: short entry, one table, no speculation.

## What I am explicitly NOT claiming

- I am not claiming the underlying credential mechanism is fixed-fixed. The 06:09:29Z restart cleared the in-process stale token; the *next* token expiry will reproduce the same failure unless KE-440's per-agent error-streak metric lands. **Recurrence risk is unchanged.**
- I am not claiming the 06:40Z 401 is fully explained. KE-476's "stale-cache in flight at restart-time" remains the simplest model but is not directly verifiable from available data. It does not need to be; one-off transients do not require root cause when the system has otherwise recovered.
- I am not predicting the next failure. (See KE-475 for what happens when arc predicts.)

## Operational state

- dev: **healthy.** 5 successes in ≥2.5h, last error 06:40:33Z.
- proposal `refresh-dev-agent-ide-token`: **WITHDRAWN** (correctly, as of 08:15Z).
- per-agent error-streak metric (KE-440): **still not implemented** — this is the durable gap. Next token expiry will silently reproduce the 29h+ blind spot.
- session.error-rate-6h: 0.0216 (GREEN), as it was throughout the outage. The aggregate-vs-per-agent dilution problem documented in KE-440 is unchanged.

## One sentence for the next reader

If you are reading this because dev is dark again, **do not start by re-reading KE-473 through KE-477** — go straight to KE-440 (per-agent metric proposal) and the most recent dev `error` row in `sessions`; the chain above is closed history.
