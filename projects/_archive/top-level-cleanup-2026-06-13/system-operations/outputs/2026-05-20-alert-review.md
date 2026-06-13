# Daily Alert Review — 2026-05-20

## Executive Summary

**39 alerts** in the last 24h across 10 distinct metrics. **4 remain unresolved**. The system is heavily dominated by two noisy metrics (`project.owner-judgment-needed-count` and `project.health.finding-count`) which together account for **70%+ of all alerts**. The alert-triage automation is responding well (median time-to-judge <5min) but spending excessive cycles on recurring structural patterns that should be addressed at the threshold or metric level.

---

## Current Unresolved Alerts

| ID | Metric | Priority | Age | Status |
|----|--------|----------|-----|--------|
| 415 | `scout.knowledge-preamble-coverage` | P3 | <1h | New, no owner action yet |
| 414 | `metric.stale-active-count` | P1 | <1h | Breached at 6 (threshold=5) |
| 413 | `project.task-parser-error-count` | P1 | <1h | Judged: fix applied (commit 8c5ae85) |
| 409 | `project.health.finding-count` | P1 | ~2h | Multiple judge attempts; routed to reconciler |

---

## Alert Volume by Metric (24h)

| Metric | Breaches | Recoveries | Net Cycles | Priority |
|--------|----------|------------|------------|----------|
| `project.owner-judgment-needed-count` | 10 | 9 | 10 fire/recover | P2 |
| `project.health.finding-count` | 9 | 7 | 9 fire/recover | P1 |
| `project.task-parser-error-count` | 5 | 4 | 5 fire/recover | P1 |
| `metric.stale-active-count` | 3 | 2 | 3 fire/recover | P1 |
| `capability.status-reality-mismatch-count` | 1 | 1 | resolved | P0 |
| `session.failed-triage-rate-3h` | 1 | 1 | resolved | P1 |
| `guard.warned-count-24h` | 1 | 1 | resolved | P3 |
| `project.invalid-format-count` | 1 | 1 | resolved | P1 |
| `project.missing-owner-workflow-count` | 1 | 1 | resolved | P1 |
| `evaluator.stale-running-session-count` | 2 | 2 | resolved | P1 |
| `scout.knowledge-preamble-coverage` | 1 | 0 | **open** | P3 |

---

## 🚨 Noisy Thresholds — Action Required

### 1. `project.owner-judgment-needed-count` (threshold=0)
- **10 breach/recover cycles in 24h** — fires every time a project finishes all tasks (triggering `owner_judgment_needed` code).
- **Root cause**: The steward fires this code whenever `allDone=true`. The system then adds a new task to clear it, which triggers recovery, then the project completes again.
- **Recommendation**: Raise threshold to 1, or suppress when the finding is `allDone` on projects with active owner loops. This metric wastes ~10 triage sessions/day.

### 2. `project.health.finding-count` (threshold=0)
- **9 breach/recover cycles** — nearly 1:1 correlated with the above metric.
- **Root cause**: Same `owner_judgment_needed` findings. The health metric double-counts what `owner-judgment-needed-count` already captures.
- **Recommendation**: Exclude `owner_judgment_needed` codes from health finding count, or raise threshold to 1.

### 3. `project.task-parser-error-count` (threshold=0)
- **5 cycles** — each time a project.md edit introduces a transient parse error (usually non-canonical status like `active` instead of `ready`).
- **Recommendation**: These self-heal within minutes. Add a 2-tick debounce or raise threshold to 1.

### 4. `metric.stale-active-count` (threshold=5, raised from 2 today)
- Threshold was calibrated up during this period (alert 383). Now breaching again at 6. The metric may need a target of 8 during high-activity periods, or a time-of-day adjustment.

---

## 🔴 Missing Owners

| Metric | Current Owner | Issue |
|--------|--------------|-------|
| `scout.knowledge-preamble-coverage` | `agent:scout` | Alert 415 unhandled — scout has no alert-triage workflow |

---

## ⏳ Unresolved Validation

- **Alert 409** (`project.health.finding-count`): Judged 4 times with different operations (`fix_root_cause`, `waiting_with_evidence`, `resolve_stale`, `upgrade_or_escalate`) but remains unresolved. The finding keeps re-appearing because the underlying project state (aks-rp-e2e completing all tasks) is structural.
- **Alert 414** (`metric.stale-active-count`): Just breached. Likely transient; monitor.

---

## 🔄 Recurring Systemic Patterns

### Pattern A: "All Tasks Done → Alert Storm"
The aks-rp-e2e project completing tasks triggers a cascade:
1. `owner_judgment_needed` fires → breach
2. Triage session adds a new task → recovery
3. New task completes → breach again

This consumed **~20 triage sessions** in 24h. The system is burning compute on a loop that should be a single human notification.

### Pattern B: Task Parser Errors from Status Vocabulary Drift
Multiple commits fix `active` → `ready` status strings. The parser is strict but project-editing code uses non-canonical statuses. A validation layer at commit time (or a lenient parser) would prevent these alerts entirely.

### Pattern C: Stale Metrics Spike During Long Operations
The `metric.stale-active-count` spikes when long-running SSH operations (e.g., iteration88 checkpoint script) block the metric refresh loop. This is expected behavior during deployments and should be suppressed or have a higher threshold.

---

## Remediation Sessions Summary

- **Total triage sessions spawned**: ~35
- **Operations used**: `fix_root_cause` (most common), `waiting_with_evidence`, `resolve_stale`, `upgrade_or_escalate`, `calibrate_metric`
- **P0 alert** (capability.status-reality-mismatch): Fixed in <4min with commit 12b7d9c4f ✅
- **Escalations to human**: 3 (failed-triage-rate, stale sessions, owner-judgment decisions)

---

## Recommendations

1. **Raise `project.owner-judgment-needed-count` threshold to 2** — eliminates 10 daily alert cycles
2. **Exclude `owner_judgment_needed` from `project.health.finding-count`** — eliminates 9 daily cycles  
3. **Add 2-tick debounce to `project.task-parser-error-count`** — eliminates 5 daily cycles
4. **Register alert-handling workflow for scout agent** — currently orphaned alerts
5. **Consider "completed project" status for aks-rp-e2e** — the recurring all-done pattern suggests the project should be marked done or have a next iteration planned

---

*Generated: 2026-05-20T~20:30Z | Window: 24h | Source: metric_alerts + events tables*
