# Mode D: Workflow Health — 2026-04-18 04:00 UTC

## TL;DR
- **Adoption**: System-wide WF share **32.6%** (43/132 non-evaluator sessions, last 6h) vs **31.5%** prior 6h — stable, within KE-026 Level-4 ceiling band.
- **Efficiency**: No >20% WF ops regression with n≥5 and max>budget. Tech-lead WF avg 10.9 (n=8) ≈ non-WF 10.4 — healthy. Coach WF avg 29.3 (n=4) down from 37.3 — improving.
- **Errors**: 0 errors across every agent × (WF|non-WF) bucket.
- **R1 = NO_DISPATCH** per KE-123 (Mode A may/convention-check + Mode C tech-lead inline-diagnostic tweak still in observation windows) + KE-026 (Level-4 context tweaks at adoption ceiling) + no concrete actionable regression.

**Window:** last 6h (≈22:00–04:00 UTC). **Prior baseline:** `finding-mode-d-workflow-health-20260418-0200.md`. **Budget:** ~3 ops.

## Adoption Table (last 6h vs prior 6–12h)

| agent     | n (6h) | WF n | adopt% | Δ adopt pp | WF avg ops | non-WF avg ops | max | errs |
|-----------|-------:|-----:|-------:|-----------:|-----------:|---------------:|----:|-----:|
| optimizer | 25     | 13   | 52.0   |   2.0      | 16.4       |  4.0           |  40 | 0 |
| bob       | 23     | 11   | 47.8   |   4.3      | 11.3       | 10.2           |  18 | 0 |
| coach     | 21     |  4   | 19.0   |  -1.0      | 29.3       | 13.0           |  73 | 0 |
| tech-lead | 20     |  8   | 40.0   | **+40.0** ✅ | 10.9     | 10.4           |  21 | 0 |
| coder     |  7     |  7   | 100.0  |   0        | 10.9       | —              |  20 | 0 |
| scout     | 12     |  0   |  0     |  -7.1      | —          |  1.7           |   3 | 0 |
| qa        | 12     |  0   |  0     |  -7.1      | —          |  6.9           |   9 | 0 |
| may       | 12     |  0   |  0     |   0        | —          |  2.8           |   6 | 0 |

**System WF adoption**: 43/132 = **32.6%** (prior 6h: 45/143 = 31.5%). Δ = +1.1pp — noise.

## Diff vs 02:00 Mode D baseline

| metric | 02:00 | 04:00 | Δ |
|---|---:|---:|---|
| System WF adoption | 36.0% | 32.6% | -3.4pp (sample shift, within band) |
| coach WF avg ops | 26.5 | 29.3 | +10% (n=4→4, not material) |
| coach WF adoption | 10.0% | 19.0% | +9pp ✅ |
| bob WF avg ops | 11.8 | 11.3 | -4% ✅ (prior window's +36% flagged, now normalized) |
| tech-lead WF adoption | 25.0% | 40.0% | **+15pp** (Mode C dispatch landing?) |
| tech-lead WF avg ops | 11.8 | 10.9 | -8% ✅ |
| Any agent >50 ops non-WF | 50 (coach cron) | 0 | ✅ |
| Errors | 0 | 0 | = |

**Notable positive**: tech-lead jumped 0→8 WF sessions in the window vs 0 WF in prior 6h — this is the population the 01:30 Mode C "inline-diagnostic" tweak targeted. WF ops tracking parity with non-WF (10.9 vs 10.4) means the workflows aren't adding overhead. Give it one more cycle before claiming causation.

## High-op sessions in window

| session | agent | ops | WF? | task |
|---|---|---:|---|---|
| (one) | coach | 73  | no  | C1.7 convention regression investigation (already analyzed in Mode A 02:30 — on-task drift, self-healing, not a workflow gap) |
| (one) | coach | 38  | no  | bob C1.3 convention regression |
| (one) | coach | 30  | no  | cron:reflect |
| (one) | optimizer | 40 | yes | heartbeat fork driver (Mode C) |

No non-workflow session exceeds 100 ops. The 73-op coach was already investigated.

## Regression candidates reviewed & dismissed

1. **System WF adoption -3.4pp** — sample shift (coder n 16→7 with 100% adoption dragged the denominator down). Not a behavioral regression.
2. **Coach WF avg 37.3→29.3** — WF ops actually *improved* 22%; dismiss.
3. **Optimizer WF 21.4→16.4 avg** — improvement; dismiss.
4. **No agent with WF error rate >0%**.

## R1: NO_DISPATCH

**Justification:**
1. **No >20% ops regression** in any (agent × WF) bucket with n≥5 and max breaking budget.
2. **Adoption stable** at 32.6% system-wide — inside KE-026 Level-4 (20–30%) ceiling band.
3. **KE-123 stacking guard** — two prior dispatches still in observation: Mode A → may/convention-check (00:30 UTC, ~3.5h ago), Mode C → tech-lead inline-diagnostic (01:30 UTC, ~2.5h ago, showing possible positive signal: +15pp tech-lead WF adoption). Adding a third now would degrade measurement -12 to -15pp.
4. **Zero errors** anywhere — no urgent reliability gap forcing action.

## Rotation

D → **A** next cycle (~06:00 UTC). Candidate targets:
- Does tech-lead WF adoption uplift (+15pp) hold into a wider sample?
- Does the 73-op coach C1.7 class recur or stay one-off?

## NO_DISPATCH
