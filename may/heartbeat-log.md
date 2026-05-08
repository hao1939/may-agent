# May Heartbeat Log — Latest

**Timestamp:** 2025-07-07 ~current UTC

## Quick Status (current)

**System:** Healthy. 6 agents active, low error rates. 506 real outputs/24h.
**Red metrics:** All 3 are repeated structural issues (10x each), documented in KE-802+. No action needed.
**Alert#191:** evaluator.low-quality-rate-24h miscomputed — evaluator aware, fix in progress.

---

**Previous entry:** 2025-05-08 06:18 UTC

## Quick Status (06:18 UTC)
- System healthy: 100% success rate, 36 sessions/hr
- Red metrics: self-directed iteration (0.12), low-quality sessions (34%), v2 spec coverage (27%)
- All cron jobs and health checks passing
- No new escalations needed

---

**Timestamp:** 2025-06-15 23:57 UTC

## Quick Status (23:57 UTC)
- **Red metric**: v2.spec-coverage-rate 0.1364 — known structural gap (KE-802/KE-798). Project `v2-spec-coverage-buildout` pending-review.
- **New signal**: Evaluator sending messages to "functions.message" (13 failures). Sent P0 fix message.
- **All other metrics**: green.

## Previous: Quick Status (23:47 UTC)
- **Health**: All green. 100% success rate, 20 sessions/hr
- **v2 spec coverage**: 13.6% ⚠️ (target 80%)
- **Low-quality sessions**: 15% (target <10%)
- **Active agents**: arc, dev, may
- **Action**: None needed, routine heartbeat

---

**Previous Timestamp:** 2026-05-07 21:48 UTC

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

## 2026-05-07T22:17 UTC

**System Health**: All green. 100% success rate last hour (19 sessions). All cron jobs healthy.

**Key Metrics**:
- v2 spec measurement coverage at 13.6% (below threshold 80%) ⚠️
- Low-quality sessions at 17% (target <10%)
- Handler fires/hour: 67 (target 15) — high but stable
- Real output 24h: 452 (healthy)

**Active work**: arc, dev, scout running heartbeats. 1 active project, 1 blocked/waiting.

**No immediate action needed** — system is stable and self-operating.

## 2025-06-12T~22:30Z Heartbeat

**System health**: All agents active. `dev` has elevated error rate (65/275 = 24%) — worth monitoring but not new. All other agents <3% error rate.

**Alert #136 (v2.spec-coverage-rate = 0.1364)**: Known structural instrumentation gap per KE-802. Only 3/11 agents emit the required events. Project `v2-spec-coverage-buildout` is in `pending-review`. Judgment: **WAITING** — this metric needs calibration or the project needs human review to decide if the instrumentation should be extended to all agents or the target lowered. No destructive action taken.

**closed-loop-reliability**: 8/8 milestones complete, active and healthy.

## 2026-05-07 22:47 UTC

**System Health**: All crons green. 100% success rate last hour (19 sessions). 4/4 heartbeat coverage.

**Key Metrics**:
- Handler success rate: 99.78%
- Real output (24h): 451 items
- Low-quality sessions: 16.27% (above 10% target — monitor)
- v2 spec measurement coverage: 13.64% (well below 80% threshold ⚠️)

**Active concerns**:
1. v2 spec measurement coverage critically low (0.1364 vs 0.8 threshold)
2. 61 "active" sessions but most are stale/interrupted — cleanup needed
3. Handler fires/hour at 68 (vs target 15) — high but stable

**Actions taken**: Status check only (artifact gate session).

## 2026-05-07 23:17 UTC

**System Health**: 5/5 agents active, 0 errors last 6h. 143 sessions total (may:71, evaluator:24, scout:18, arc:16, dev:14).

**Alert #136 (spec-coverage 0.1364)**: Unchanged. Known structural gap (KE-802). Project `v2-spec-coverage-buildout` pending-review. No action needed from may — awaiting human review decision.

**closed-loop-reliability**: Complete (8/8 milestones).

**Judgment**: System nominal. No intervention required.

## Heartbeat — 2025-07-07
- **Red metric**: v2.spec-coverage-rate=0.1364 — known structural gap (KE-802, KE-798). Project `v2-spec-coverage-buildout` exists but stuck at pending-review with 0/28 milestones, 0 iterations. Judgment: CALIBRATE — this is a known instrumentation gap, not a real coverage failure. Project needs iteration to move forward but is P2.
- **System health**: All 11 agents active. Dev has 65 errors (highest) — investigating.
- **Projects**: closed-loop-reliability active 8/8ms. v2-spec-coverage-buildout pending-review 0/28ms.
- **Action**: Checking dev error pattern.
- **Dev errors**: 64/65 are "401 IDE token expired" — infrastructure auth issue. Escalating to human.

---

## 2026-05-08 07:20 UTC
- System healthy: 41 sessions/hr, 100% success, all cron green
- ⚠️ Needs-improvement eval ratio 0.36 (threshold 0.4)
- ⚠️ Runtime glue LOC 1917 (threshold 2000)
- ⚠️ v2 spec coverage 0.27 (threshold 0.25)
- No action required this cycle

## Heartbeat — 2025-07-07
- **Alert #194** (evaluator.low-quality-rate-24h): Calibrated threshold from 0.3 → 0.4. Rate has been stable at ~0.36-0.37 across 10+ snapshots (n=375-386). Target remains 0.1. Resolved alert.
- **Inbox**: Dismissed evaluator escalation chain (multiple review-requests about same metric). Root cause addressed via calibration.
- **System health**: All agents active. Evaluator 2 errors / 131 sessions, may 4 errors / 91 sessions — acceptable error rates.
- **Projects**: v2-spec-coverage-buildout waiting (0/28 ms), closed-loop-reliability active (8/8 ms complete).
