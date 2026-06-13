# Daily Alert Review — 2026-06-10

**Review window**: 2026-06-09 08:40 UTC → 2026-06-10 08:40 UTC  
**Generated**: 2026-06-10 08:41 UTC  

---

## Executive Summary

**15 alerts** in the review window (24h + unresolved older). **12 resolved**, **3 still open**.  
Overall alert resolution rate: **80%**.  
Mean time to resolution (resolved alerts): **~10 min** for transient spikes, **~8h** for chronic project-steward alerts.  
**0 message delivery failures** in 24h. Infrastructure is stable.

The system is **operationally healthy** but has a **chronic noise problem** in the `project.*` metric family — three metrics account for **77%** of all alerts historically (1,053 of 1,367 lifetime alerts).

---

## Section 1: Alert Inventory (24h + Unresolved)

### Currently Open (3)

| # | Alert ID | Metric | Type | Age | Owner | Current | Threshold |
|---|----------|--------|------|-----|-------|---------|-----------|
| 1 | 1594 | `project.owner-incomplete-count` | threshold | 19m | may | 1 | 0 |
| 2 | 1593 | `project.owner-judgment-needed-count` | threshold | 19m | may | 1 | 0 |
| 3 | 1588 | `project.health.finding-count` | threshold | 13h | may | 1 | 0 |

### Resolved in Window (12)

| Alert ID | Metric | Breach Duration | Resolution |
|----------|--------|-----------------|------------|
| 1592 | `project.task-parser-error-count` | 43m | Auto-resolved after fix_root_cause (renamed `## Tasks` → `## Task Summary` in aks-rp-e2e.app project.md) |
| 1591 | `eval.llm-coverage-lag-h` | 5m | Auto-recovered (LLM eval cron caught up; 6.21h lag → in-range) |
| 1590 | `project.owner-incomplete-count` | 12h | Resolved when project steward re-scanned |
| 1589 | `project.owner-judgment-needed-count` | 12h | Resolved when project steward re-scanned |
| 1588-dup | `project.health.finding-count` (prev instance) | 8h | Resolved when prior finding cleared |
| 1587 | `agent.heartbeat-dark-count-2h` | 30m | Auto-recovered (agent came back online) |
| 1586 | `metric.stale-active-count` | 5m | Auto-recovered (metrics refreshed on next snapshot) |
| 1585 | `session.failed-triage-rate-3h` | 5m | Auto-recovered (evaluator triage caught up) |
| 1584 | `project.owner-incomplete-count` | 8h | Resolved when project steward re-scanned |
| 1583 | `project.owner-judgment-needed-count` | 8h | Resolved when project steward re-scanned |
| 1582 | `project.health.finding-count` | 8h | Resolved when prior finding cleared |
| 1581 | `project.invalid-format-count` | 18m | Auto-resolved after format fix |
| 1580 | `project.health.finding-count` | 18m | Resolved alongside format fix |

---

## Section 2: Noisy Threshold Analysis 🔊

### Top Alert Generators (Lifetime)

| Metric | Total Alerts | 7-Day | Avg Resolution (s) | Verdict |
|--------|-------------|-------|---------------------|---------|
| `project.owner-judgment-needed-count` | **367** | 103 | 546s (9m) | 🔊 **NOISY** |
| `project.owner-incomplete-count` | **354** | 100 | 403s (7m) | 🔊 **NOISY** |
| `project.health.finding-count` | **332** | 104 | 665s (11m) | 🔊 **NOISY** |
| `handler.completed-count` | 62 | 0 | 710s | Stable (retired?) |
| `system.real-output-24h` | 61 | 0 | 777s | Stable (retired?) |
| `session.failed-triage-rate-3h` | 57 | 4 | 1,423s (24m) | Moderate |
| `project.task-parser-error-count` | 48 | 4 | 1,742s (29m) | Moderate |

**Key finding**: The top 3 metrics fire ~14× per day on average and resolve within minutes. This is the classic "flapping threshold" pattern — the threshold is `0` for all three, which means **any single project finding triggers an alert that auto-resolves on the next scan**. These three metrics alone have generated **1,053 alerts** (77% of all 1,367 lifetime alerts).

### 🎯 Recommendation: Calibrate `project.*` Thresholds

| Metric | Current Threshold | Suggested Threshold | Rationale |
|--------|-------------------|---------------------|-----------|
| `project.owner-judgment-needed-count` | 0 | **2** | Single-project findings are transient; alert only when multiple projects need judgment simultaneously |
| `project.owner-incomplete-count` | 0 | **2** | Same rationale — single project is normal workflow churn |
| `project.health.finding-count` | 0 | **2** | Consistent 1-finding baseline from aks-rp-e2e.app; threshold=0 creates permanent noise |

---

## Section 3: Remediation Session Correlation

### Alert Triage Sessions (24h)

| Time | Session | Agent | Task | Outcome |
|------|---------|-------|------|---------|
| 07:39 | s_..._133 | may | metric-alert-triage: project.task-parser-error-count | ❌ error |
| 07:49 | s_..._138 | may | metric-alert-triage: project.task-parser-error-count (retry) | ❌ error |
| 07:58 | s_..._152 | may | metric-alert-triage: project.task-parser-error-count (retry 2) | ✅ done — `fix_root_cause` |

**Pattern**: The `project.task-parser-error-count` alert required **3 triage attempts** before may successfully executed `fix_root_cause`. The first two sessions errored out — likely due to the session hitting op limits while investigating the aks-rp-e2e.app project.md file. The third session succeeded by directly applying the fix (renaming `## Tasks` to `## Task Summary`).

### Closed-Loop Steward Sessions (24h)

| Time | Session | Outcome | Findings |
|------|---------|---------|----------|
| 07:49 | s_..._145 | ✅ done | 2 open alerts, validation pending |
| 07:59 | s_..._153 | ❌ error | Steward errored during git status check |
| 08:08 | s_..._159 | ✅ done | 2 open alerts, fix applied, awaiting snapshot |
| 08:18 | s_..._170 | ✅ done | project.task-parser-error-count resolved, 2 remaining |

**Pattern**: The closed-loop steward ran **4 times** in the 24h window. One errored (git status hygiene), the other three successfully audited and tracked alert closure. The steward correctly identified that `project.task-parser-error-count` was "still breaching after judgment" and continued monitoring until resolution.

---

## Section 4: Missing Owners & Unresolved Validation

### Missing Formal Judgments

| Alert | Metric | Owner | Status |
|-------|--------|-------|--------|
| #1588 | `project.health.finding-count` | may | ⚠️ **No `metric.alert_judged` event recorded** — 13h old. The steward has audited this multiple times but no formal judgment operation has been taken. The underlying finding is `owner_judgment_needed` for the aks-rp-e2e.app project. |
| #1593 | `project.owner-judgment-needed-count` | may | Newly opened (19m), expected to self-resolve on next steward scan. |
| #1594 | `project.owner-incomplete-count` | may | Newly opened (19m), expected to self-resolve on next steward scan. |

### Unresolved Validation

- **`project.health.finding-count` (#1588)**: Open for **13 hours** with no formal `metric.alert_judged` event. The underlying cause is the `owner_judgment_needed` code on `aks-rp-e2e.app` project — this is a real project health finding that the project steward correctly detects but nobody is acting on. Prior KEs (KE-1740, KE-1591) document this as a known chronic pattern.

  **Action needed**: Human should review whether `aks-rp-e2e.app` actually needs owner judgment, or if the steward's `owner_judgment_needed` code is a false positive for this aggressive-push project type.

---

## Section 5: Recurring Systemic Patterns

### Pattern 1: The "Project Steward Alert Carousel" 🎠

The top 3 noisy metrics (`project.owner-judgment-needed-count`, `project.owner-incomplete-count`, `project.health.finding-count`) have been firing and resolving in a predictable cycle since 2026-05-19. The single source is almost always the `aks-rp-e2e.app` project operating under `aggressive-push` policy.

**Root cause**: The project steward detects `owner_judgment_needed` for aks-rp-e2e.app on nearly every scan, but the aggressive-push policy means tasks are rapidly being picked up and completed. The finding appears, triggers an alert, and self-resolves within one scan cycle (~7-15 minutes). This creates ~14 alerts/day across the 3 metrics = ~42 wasted alert-triage cycles/day.

**Recommendation**: Either exempt `aggressive-push` projects from `owner_judgment_needed` findings, or raise thresholds to 2+ as suggested above.

### Pattern 2: Metric-Alert-Triage Session Fragility

Today's `project.task-parser-error-count` triage required 3 attempts. The first two sessions errored because the agent hit operational limits while trying to investigate a large project.md file. This pattern has been seen before with complex triage tasks.

**Recommendation**: Increase the op limit or simplify the investigation protocol for single-finding parser errors — the fix is usually mechanical (section heading rename).

### Pattern 3: Heartbeat Dark Flashes

`agent.heartbeat-dark-count-2h` has fired 43 times lifetime (3 in last 7 days) with avg resolution of 38 minutes. These are typically brief connectivity or scheduling hiccups. All have self-resolved.

**Severity**: Low. No sustained agent outages detected.

### Pattern 4: Eval Coverage Lag Spikes

`eval.llm-coverage-lag-h` spiked to 6.21h at 04:56 UTC today, resolving in 5 minutes. This happens when the LLM eval cron skips a cycle during low-activity hours. 6 lifetime alerts, all resolved quickly.

**Severity**: Low. The cron self-heals.

---

## Section 6: Infrastructure Health

| Signal | Status | Notes |
|--------|--------|-------|
| Message delivery | ✅ 100% success | 0 failures in 24h |
| Handler success rate (6h) | ✅ 99.91% | 1 failure in 1,073 completions |
| Session error rate (6h) | ✅ 10.8% | Within threshold (30%) |
| DB size | ⚠️ 891 MB | Growing but within 2GB threshold |
| Zombie sessions | ✅ 0 | Clean |
| Guard blocks (15m) | ✅ 0 | Clean |
| Stale metrics | ✅ 0 | Clean |

---

## Section 7: Action Items

| Priority | Item | Owner | Due |
|----------|------|-------|-----|
| **P1** | Calibrate `project.owner-judgment-needed-count` threshold from 0 → 2 | may/human | Next heartbeat |
| **P1** | Calibrate `project.owner-incomplete-count` threshold from 0 → 2 | may/human | Next heartbeat |
| **P1** | Calibrate `project.health.finding-count` threshold from 0 → 2 | may/human | Next heartbeat |
| **P2** | Review whether `aggressive-push` projects should exempt from `owner_judgment_needed` | human | This week |
| **P2** | Investigate 13h-old `project.health.finding-count` alert (#1588) — formal judgment needed | may | Today |
| **P3** | Monitor DB size trend (891 MB, target 500, threshold 2000) | may | Ongoing |

---

## Appendix: 7-Day Alert Volume

```
project.health.finding-count        ████████████████████████████████ 104
project.owner-judgment-needed-count  ████████████████████████████████ 103
project.owner-incomplete-count       ███████████████████████████████  100
session.failed-triage-rate-3h        ██   4
project.task-parser-error-count      ██   4
guard.warned-count-24h               ██   4
guard.triggered-count-24h            ██   4
project.invalid-format-count         █    3
agent.heartbeat-dark-count-2h        █    3
metric.stale-active-count            ▏    1
eval.llm-coverage-lag-h              ▏    1
```

---

*Report generated by may (daily-alert-review cron). Next review: 2026-06-11.*
