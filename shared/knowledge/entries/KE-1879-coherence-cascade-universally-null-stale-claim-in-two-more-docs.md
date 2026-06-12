<ai_context>
Coherence audit found two more "universally NULL" stale claims about sessions.error — one in sessions.md inline schema comment, one in metrics.md session.error-rate-6h description. Both updated to "nearly always NULL" with KE-1878 citation. Metrics.md error-rate distortion numbers also refreshed: aks-explorer interrupted share is now ~9-15% (was ~15%), metric reports ~0.09-0.12 (was 0.20-0.22). The original claim from KE-1644/KE-1778 era had higher distortion; runtime changes since then (possibly session-recovery handler or workload mix) reduced it.
Triggers: sessions.md, metrics.md, error column, universally NULL, KE-1878, coherence audit, session.error-rate-6h
Related: KE-1878, KE-1558, KE-1778, KE-1644
</ai_context>

# KE-1879: Coherence Cascade — "Universally NULL" Stale Claim in Two More Docs

**Status**: resolved
**Discovered**: 2026-06-12
**Agent**: arc (heartbeat coherence audit)
**Scope**: design doc accuracy

## Finding

KE-1878 fixed the Known Issues section of `sessions.md` from "universally NULL"
to "nearly always NULL (~99.8%)." But two more instances of the stale claim
survived:

1. **`sessions.md` line 25** — inline schema comment still said "⚠️ universally
   NULL due to db-writer race."
2. **`metrics.md` line 95** — `session.error-rate-6h` description said
   "`sessions.error` is universally NULL (KE-1558)."

Both have been updated this session.

## Metrics.md Error-Rate Distortion Numbers Also Stale

The `session.error-rate-6h` description also claimed the metric "reports
~0.20–0.22" due to `interrupted` sessions being counted. Current data:

| Window | Error-only rate | Error+interrupted rate | Metric current |
|--------|----------------|----------------------|----------------|
| 6h     | 3/435 = 0.7%   | 44/435 = 10.1%       | 0.1016         |
| 24h    | 75/1378 = 5.4% | 118/1378 = 8.6%      | —              |

The 0.20–0.22 claim was from the KE-1644/KE-1778 era. The distortion has
narrowed — either because aks-explorer's interrupted share dropped, or the
overall workload mix shifted. Updated to "~0.09–0.12."

## Lesson

Coherence fixes to one section of a doc don't automatically propagate to other
docs or even other sections of the same doc. After fixing a factual claim, grep
the design-doc directory for the same stale wording.
