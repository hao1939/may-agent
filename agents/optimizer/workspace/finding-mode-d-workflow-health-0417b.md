# Mode D — Workflow Health (2026-04-17 ~18:00 UTC)

**Window:** last 6h (≈12:00–18:00 UTC) and last 24h.
**Baseline:** prior Mode D at 16:00 UTC (`finding-workflow-health-20260417-1600.md`), which dispatched **R1 = add budget stanza to `[cron:project-resume]` task string** (`agents/may/handlers/project-resume.ts:158`).
**Budget used:** ~10 ops.

## Summary

Prior R1 fix **is deployed and working** (confirmed in source at line 158 of `project-resume.ts`, and in the data: cron:project-resume average dropped **35.9 → 10.7 ops (-70%)**). System is in a **clean measurement window** — no interrupts, 1 transient LiteLLM auth error (external), no workflow regressing. One observation worth tracking (coder `implement-and-verify` retry rate) but no low-risk concrete fix this cycle.

**Top finding this cycle: PRIOR FIX VALIDATED. No new fix dispatched.** Per KE-123 (don't stack interventions), we hold for one more window before acting on the next-tier items.

## Data

### 6h sessions by agent × workflow-bucket (non-evaluator)

| agent       | wf? |  n | avg  | total | err |
|-------------|-----|---:|-----:|------:|----:|
| coach       | non | 24 | 18.0 |  432  | 3 ¹ |
| may         | non | 45 |  7.3 |  327  | 0   |
| tech-lead   | non | 18 | 15.7 |  282  | 1 ² |
| coder       | wf  |  9 | 27.6 |  248  | 0   |
| bob         | wf  | 20 |  8.5 |  170  | 1 ² |
| optimizer   | wf  | 10 | 16.3 |  163  | 1 ² |
| coach       | wf  |  7 | 17.7 |  124  | 0   |
| scout       | non | 13 |  8.2 |  106  | 0   |
| optimizer   | non | 14 |  7.3 |  102  | 1 ² |
| scout       | wf  |  3 | 32.0 |   96  | 0   |
| qa          | non | 12 |  6.7 |   80  | 0   |
| bob         | non | 15 |  5.0 |   75  | 0   |
| may         | wf  | 10 |  3.8 |   38  | 0   |
| tech-lead   | wf  |  4 |  7.8 |   31  | 0   |

¹ coach errors: 1 LiteLLM 401 auth (external), 1 cron:reflect (null err), 1 cron:common-sense-verify (null err). Not workflow failures.
² one-off transient `null`/timeout errors, no pattern.

### 6h by task-class

| class                  |  n | avg  | total | max |
|------------------------|---:|-----:|------:|----:|
| work-session-lens      | 72 | 12.2 |  878  | 76  |
| other                  | 59 | 12.4 |  734  | 74  |
| cron-project-resume    | 29 | 10.7 |  309  | 44  |
| heartbeat              | 27 |  6.3 |  170  | 27  |
| persistent-task (wf)   |  3 | 28.3 |   85  | 55  |
| verify-wrap            | 11 |  6.5 |   71  | 10  |
| other-cron             |  3 |  9.0 |   27  | 27  |

### 24h by task-class (for trend context)

| class                  |   n | avg  | total | max |
|------------------------|----:|-----:|------:|----:|
| work-session-lens      | 282 |  9.3 | 2,612 | 143 |
| other                  | 118 | 10.8 | 1,279 |  82 |
| cron-project-resume    |  67 |  6.9 |   459 |  44 |
| heartbeat              | 100 |  4.5 |   455 |  27 |
| verify-wrap            |  47 |  7.7 |   364 |  24 |
| persistent-task (wf)   |  12 | 26.2 |   314 |  55 |

### Prior-fix validation

| metric                             | 16:00 scan | 18:00 scan | direction |
|------------------------------------|-----------:|-----------:|-----------|
| cron:project-resume avg ops        | 35.9 (n=7) | **10.7 (n=29)** | ✅ **-70%** |
| cron:project-resume max ops        | 44         | 44         | = (tail unchanged, mean moved) |
| Interrupt rate                     | 0.0%       | 0.0%       | = |
| Lens-analysis avg (wf)             | 6.6        | ~6.4       | = |
| Verify-wrap avg                    | ~8         | 6.5        | ✅ |
| persistent-task avg/tree (wf)      | 53.0 (anomaly) | 28.3  | ✅ back to normal |

**R1 delivered ~-70% on targeted metric.** The per-iteration count 29 in 6h is high (vs 7 prior) but expected — cron fires frequently; what matters is mean ops, which halved-then-halved-again.

### Coder `implement-and-verify` 24h (for observation)

| workflowRunId         | sessions | total ops | avg  |
|-----------------------|---------:|----------:|-----:|
| wr_…1ch2              | 1        | 51        | 51   |
| wr_…1jpm              | 2        | 51        | 25.5 |
| wr_…w413              | 2        | 50        | 25   |
| wr_…4xdd              | 2        | 40        | 20   |
| wr_…zds2              | 1        | 35        | 35   |
| wr_…29ri              | 1        | 21        | 21   |
| wr_…dqmy              | 2        | 15        |  7.5 |
| wr_…12lh              | 2        | 11        |  5.5 |

- 8 trees, 13 coder sessions, 274 ops.
- **5/8 (62.5%) triggered attempt-2 "Fix Required"** (defined in `agents/shared/workflows/implement-and-verify.ts:144`).
- Attempt-2 is cheap (~9 ops median) — not the bottleneck.
- **Attempt-1 is the cost center**: 35 ops avg across first-attempts, range 21–51.

## Top Finding

**F1 — Prior R1 validated; no new regressions. Hold.**

The budget stanza added to `[cron:project-resume]` yesterday reduced that class's mean from 35.9 → 10.7 ops/session (-70%) while preserving the "do not exit early" override path for project files that need it. No other workflow shows a regression this window.

**F2 (observation, no action this cycle) — coder `implement-and-verify` attempt-1 variance.**
- 62.5% retry rate over 24h (n=8 trees, small sample).
- Attempt-1 first sessions range 21–51 ops; the two shortest (5.5 and 7.5 avg) suggest there's room if attempt-1 prompt were tighter, but we have no evidence the `## Reference` few-shot preamble (injected via `injectFewShot`, EXP-094/095) is the cause.
- KE-133 says few-shot harms *discovery* tasks. `implement-and-verify` tasks have explicit verify commands (not discovery) so the few-shot may still be helping. An A/B would be needed before touching it.
- **Deferred to next Mode D** with explicit A/B spec — do not change blindly.

## Fix Spec

**No new fix this cycle.** This is a deliberate hold decision:

1. **Prior R1 is in clean measurement** (first 6h post-deploy, -70% effect, 0 interrupts). Per KE-123, don't stack interventions on top of a fix still being measured.
2. **F2 needs A/B evidence**, not a blind change — see "Next-check plan" below.
3. **Coach heartbeat at 18.0 ops (6h avg, n=24)** is elevated vs optimizer's 6.3 — but KE-008 forbids restructuring heartbeat steps. Content-only coach HB tightening could be proposed by the coach agent itself (not by optimizer), so this is logged as an observation and not a dispatch.

## Dispatch Status

**No dispatch this cycle.** Finding is informational + validation of prior Mode D (16:00 UTC) R1. Tech-lead does not need new instructions.

If tech-lead or coach self-audit surfaces the coder retry rate as actionable, the relevant file is `agents/shared/workflows/implement-and-verify.ts:126-154` (attempt loop + injectFewShot call site).

## Next-check plan (Mode D @ ~00:00 UTC, +6h)

1. **Re-confirm cron:project-resume avg stays ≤15 ops** over a 24h window (current 24h is mixed pre/post R1 at 6.9 avg — post-only should converge near 10).
2. **Count coder `implement-and-verify` retries over 24h** — if still ≥60%, consider an experiment spec: 50/50 A/B of attempt-1 with vs without `injectFewShot` few-shot preamble. This is a *measurement* dispatch to tech-lead, not a code change.
3. **Heartbeat class watch**: if coach HB avg climbs >20 ops/session over 12h, flag to coach agent (not tech-lead) for content-only reduction.

## Rotation marker

Next rotation: **A (Session Archaeology)** or continue through cycle — consult todo.md rotation log.

[SIG: 1776449200:mode-d-0417b]
