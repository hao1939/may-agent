# May Heartbeat Log — Latest

**Timestamp:** 2026-05-07 21:48 UTC

## Quick Status (21:48 UTC)
- System healthy: 100% success rate, 18 sessions/hr
- All cron jobs green, 4/4 agent heartbeat coverage
- v2 spec coverage still low (0.14 vs 0.8 target) ⚠️
- Low-quality session rate 17.8% (target <10%)

---

## Previous: 2026-05-07 21:17 UTC

## Quick Status
- System healthy: 100% success rate, 19 sessions/hr
- 61 active sessions (many stale)
- Handler fires/hr: 66 (target 15) - elevated
- v2 spec coverage: 13.6% ⚠️ (target 100%)
- Low-quality sessions: 18.6% (target 10%)

---

## Previous: 2026-05-07 18:49 UTC

## System Snapshot
- **Success rate**: 100% (30 sessions/hr)
- **Real output**: 448/24h (healthy, target 100)
- **Heartbeat coverage**: 4/4 agents
- **Handler success rate**: 98.96%

## Red Metrics — Unchanged
- session-trace-completeness=0.002: KE-799/795
- v2.spec-coverage-rate=0.14: KE-798
- No new red metrics since last check.

## Notes
- 60 active sessions visible, most are stale/interrupted leftovers
- System stable, no intervention needed

---

**Previous Timestamp:** 2026-05-08 ~12:20 UTC

## Red Metrics — All Known (10+ consecutive)
- handler.failed-count=6: KE-793 self-loop
- project.active-count=0: KE-794/780 tech-lead frozen
- v2.spec-coverage-rate=0.14: KE-798 path mismatch
- session-trace-completeness=0.002: KE-799/795 event storm

## Action: dev agent 25% error rate (64x "401 IDE token expired")
Nudged arc P1 to investigate token rotation.

---

## Previous: 2026-05-07 ~17:00 UTC

## Red Metrics Assessment

### handler.failed-count: 6 (target 0)
**Status:** Known issue, documented in KE-793/KE-792.
**Action:** No new investigation needed. Per KE-793, this is caused by the self-referential metric.stale-active-count alert loop that spawns sessions which error out. The reactor-dedup fix (proposal from 2026-05-06) is the proper remediation. Escalation not needed — already documented.

### v2.spec-coverage-rate: 0.1364 (target 1)
**Status:** Known issue per KE-793 reference. This metric measures v2 spec coverage which is a long-term build-out, not an acute failure. The target of 1.0 represents full coverage which is aspirational.
**Action:** Calibration candidate — target should reflect incremental progress. No destructive action needed.

### capability.session-trace-completeness: 0.0022 (target 1)
**Status:** Repeated alert (8x). This measures trace completeness infrastructure that hasn't been fully built out yet.
**Action:** Calibration candidate. The 0.0022 value suggests the tracing system captures very few sessions. This is an infrastructure gap, not a failure requiring investigation.

## System Health
- DB tables are empty in local context — no direct session data available for analysis.
- All other metrics are green. System is producing output (369 real outputs/24h vs target 100).
- No active projects requiring attention.

## Disposition
All three red metrics are **previously documented known issues** (KE-792, KE-793). No new investigation or destructive action warranted. The proper fixes are infrastructure improvements (reactor dedup restoration, spec coverage buildout, trace system completion) that are tracked elsewhere.

---

## 2026-05-07 15:59 UTC Update

- **Success rate**: 97% (29 sessions/hour)
- **Low-quality sessions**: 46.7% (worsening — was flagged before)
- **Active projects**: still 0
- **Real output**: 410/24h (healthy)
- 20+ stale/interrupted sessions visible in system status

## 2025-06-22 ~04:30 UTC

**Red metrics:**
- `v2.spec-coverage-rate` (0.14) and `capability.session-trace-completeness` (0.002): Both downgraded to P3. KE-802 confirms these are structural instrumentation gaps (only 3/11 agents emit required events). Not actionable without expanding instrumentation to all agents.

**System health:**
- Dev agent: 24% error rate (65/268 sessions) — all "401 IDE token expired". Infrastructure issue, escalated to human.
- All other agents healthy. Error rates nominal.

**Actions:** Downgraded 2 alerts to P3, escalated dev token issue.
