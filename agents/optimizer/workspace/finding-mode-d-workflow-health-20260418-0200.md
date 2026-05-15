# Mode D — Workflow Health (2026-04-18 ~02:00 UTC)

**Window:** last 6h (≈20:00–02:00 UTC).
**Prior baseline:** `finding-mode-d-workflow-health-20260418-0000.md` (00:00 UTC, 2h ago).
**Budget used:** ~4 ops.

## TL;DR

No actionable regression. System-wide workflow adoption is stable ~36% (last 6h). The only agent-level ops regression is **bob WF avg 8.7 → 11.8 (+36%)** but with max=18 and zero errors — within normal variance, no outlier session. **coach WF adoption dipped 15.8% → 10% (n=2/20, noise)**; **may WF dropped 9.4% → 0% (0/12)** but may sessions are heartbeat-only avg 3 ops (already at the floor). No workflow >0% error rate. No non-WF session exceeded 50 ops in window.

**Decision: NO_DISPATCH.** Per KE-123 (don't-stack interventions), two recent dispatches are still in observation:
- Mode A → may convention-check patch (bash-as-read + verification pattern) — dispatched ~00:30 UTC.
- Mode C → tech-lead inline-diagnostic prompt tweak — dispatched ~01:30 UTC (this cycle).

Rotate **D → A** next cycle.

## Adoption Table (last 6h vs prior 6–24h)

| agent     | WF n | total n | adopt% | Δ adopt pp | WF avg ops | Δ WF ops | errs |
|-----------|-----:|--------:|-------:|-----------:|-----------:|---------:|-----:|
| coder     |  11  |   11    | 100.0  |   0        |  9.4       | -47% ✅  | 0 |
| optimizer |  13  |   25    |  52.0  |  +6.7      | 18.2       | +13%     | 0 |
| bob       |  11  |   23    |  47.8  | **+11.9** ✅ | 11.8     | +36% ⚠   | 0 |
| tech-lead |   4  |   16    |  25.0  |  -1.6      | 11.8       | +71% (n=4) | 0 |
| coach     |   2  |   20    |  10.0  |  -5.8      | 26.5       | +27% (n=2) | 0 |
| qa        |   0  |   13    |   0.0  |  -5.3      | —          | —        | 0 |
| scout     |   0  |   12    |   0.0  |  -9.5      | —          | —        | 0 |
| may       |   0  |   12    |   0.0  |  -9.4      | —          | —        | 0 |
| evaluator |   0  |   43    |   0.0  |   0 (n/a)  | — (JS-only) | —       | 0 |

System-wide adoption: **36.0%** (54 WF / 150 non-evaluator).

## Regression candidates reviewed & dismissed

1. **bob WF +36% ops** — 11 sessions, max 18, zero errors, no long tail. Normal variance within D-o-R workloads; prior 8.7 was an unusually lean window.
2. **coach WF 15.8→10%** — n=2 in last 6h, purely sample noise. Coach has been stable at 10–20% WF adoption for weeks.
3. **may 9.4→0%** — may is heartbeat-only dispatcher (avg 3 ops, max 6). It's already at the lean floor; no workflow would shave ops.
4. **tech-lead WF avg +71%** — n=4, max=21, one 20-op D-o-R P1. Within budget. The prior dispatch (Mode C 01:30) targets exactly this pattern; give it time.
5. **No workflow with error rate >10%** — all agent/WF buckets at 0 errors.

## High-op non-workflow sessions (≥20 ops, 6h window)

| session | agent | ops | task kind |
|---|---|---:|---|
| (one)   | coach     | 50 | cron:common-sense-verify (cron, inherently single-shot) |
| (one)   | tech-lead | 25 | heartbeat (no workflow applies) |
| (one)   | tech-lead | 22 | heartbeat |
| (one)   | coach     | 21 | cron:common-sense-verify |
| (one)   | optimizer | 19 | heartbeat (Mode C fork driver) |

None map cleanly to an existing workflow. The 50-op coach cron is worth a separate future probe (Mode A candidate) but is not a workflow-adoption gap.

## R1: NO_DISPATCH

**Justification:**
1. **No >20% ops regression with n≥5 and max>budget** — the only WF ops bump (bob +36%, n=11) has max 18 ops, well inside D-o-R envelope.
2. **No >5pp adoption drop with actionable cause** — the three -5 to -9pp drops (coach/may/scout) are either (a) sample noise (n≤2 WF), or (b) chronic lean-floor agents where workflows wouldn't help.
3. **KE-123 stacking guard** — Mode A patch (may convention-check) and Mode C tweak (tech-lead inline-diagnostic) are both in their observation windows; adding a third behavioral intervention now would degrade measurement -12 to -15pp per KE-123.
4. **KE-026 Level-4 ceiling** — any new prompt-level tweak is Level 4 (context text) which hits adoption ceiling ~20–30%. Not worth spending the stacking budget.

## Rotation

D → **A** next cycle (~04:00 UTC): re-check whether bob WF ops regression persists over a wider sample, and whether the 50-op coach cron pattern recurs.

## NO_DISPATCH
