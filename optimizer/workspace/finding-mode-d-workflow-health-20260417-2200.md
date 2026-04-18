# Mode D — Workflow Health (2026-04-17 ~22:00 UTC)

**Window:** last 6h (≈16:00–22:00 UTC).
**Prior baseline:** `finding-mode-d-workflow-health-0417b.md` (18:00 UTC).
**Budget used:** ~7 ops.

## Summary

Adoption distribution is **stable**: coder 100%, optimizer 50%, bob 43.5%, coach 20%, may/tech-lead **0%**, qa/scout 7.1%. Prior R1 (cron:project-resume budget stanza) continues to hold — only 2 resume sessions this window, avg 21 ops (n too small to trend).

**Two high-op non-workflow sessions stand out and are the whole story this cycle:**

- **tech-lead 74-op P0 refactor** (`s_1776442914838_479`, "Split agents.message into a separate `notify` tool") — done inline by tech-lead with zero workflow, no dispatch to coder. Exactly the case `implement-and-verify` exists to handle.
- **coach 76-op weekly promoted-skill regression check** (`s_1776444880857_502`) — scripted gym-run type work, no workflow wrap.

These two sessions alone contributed 150 ops — **28% of the 526-op work-session-lens total** this window.

Work-session-lens avg jumped **12.2 → 21 ops** vs prior window, driven entirely by these two sessions. Heartbeat class is stable at 6.5 ops avg (84 sessions).

**Decision: hold on dispatch.** Per KE-123 don't-stack rule, the 16:00 UTC R1 fix is still in its first clean 24h. Log the tech-lead inline-refactor pattern as a candidate for next cycle.

## Data

### 6h adoption by agent

| agent     | wf |  n | avg  | tot  | adoption% |
|-----------|----|---:|-----:|-----:|----------:|
| coder     | wf | 16 | 15.5 |  248 | **100**   |
| optimizer | wf | 13 | 20.8 |  270 | 50.0      |
| optimizer | non|13 |  6.5 |   85 |           |
| bob       | wf | 10 | 12.4 |  124 | 43.5      |
| bob       | non|13 |  6.9 |   90 |           |
| coach     | wf |  4 | 37.3 |  149 | 20.0      |
| coach     | non|16 | 13.7 |  219 |           |
| qa        | wf |  1 | 20   |   20 | 7.1       |
| scout     | wf |  1 | 41   |   41 | 7.1       |
| **may**   | non|15 |  6.0 |   90 | **0**     |
| **tech-lead** | non|15| 16.4| 246 | **0**     |

### 6h by task-class

| class                  |  n | avg  | total | max |
|------------------------|---:|-----:|------:|----:|
| heartbeat              | 84 |  6.5 |  543  | 25  |
| work-session-lens      | 25 | 21.0 |  526  | 76  |
| verify-wrap            | 11 | 18.7 |  206  | 42  |
| other-wf               | 10 | 19.6 |  196  | 59  |
| other                  |  8 | 24.4 |  195  | 74  |
| cron-project-resume    |  2 | 21.0 |   42  | 23  |
| other-cron             |  3 | 13.7 |   41  | 27  |

### Prior R1 status (cron:project-resume)

| window           | n  | avg | max |
|------------------|---:|----:|----:|
| 16:00 scan       |  7 | 35.9| 44  |
| 18:00 scan       | 29 | 10.7| 44  |
| **22:00 scan**   |  2 | 21.0| 23  |

n=2 is too small to trend; no regression signal (max 23 < prior 44).

### High-op non-workflow spot-checks (20+ ops)

| session | agent | ops | task |
|---|---|---:|---|
| s_1776444880857_502 | coach | **76** | Weekly promoted-skill gym regression check |
| s_1776442914838_479 | tech-lead | **74** | P0 refactor: split `agents.message` into `notify` tool |
| s_1776453350862_574 | scout | 36 | Audit 3 recently-landed tech-lead commits |
| s_1776448837635_535 | coach | 27 | [cron:reflect] reflection procedure |
| s_1776442519721_477 | tech-lead | 26 | P0 backfill thresholds (M5) |
| s_1776459642133_628 | tech-lead | 25 | heartbeat |
| s_1776443232956_487 | may | 23 | cron:project-resume |
| s_1776450642165_550 | tech-lead | 22 | heartbeat |

Two heartbeats (tech-lead 22, 25) are tail — no workflow applies there.
Scout audit at 36 and cron:reflect at 27 are inherently manual; no clean workflow match.
Cron:project-resume 23 is within budget.

**The actionable pair: tech-lead 74 + coach 76.**

## Top Finding

**F1 — Tech-lead inline-refactor anti-pattern (candidate for next cycle).**

`s_1776442914838_479` (74 ops) = tech-lead implementing a P0 refactor directly instead of dispatching to coder with `implement-and-verify`. Tech-lead adoption this window: **0/15 sessions (0%)**. May adoption: **0/15 (0%)**. Both agents should be forking work to coder (100% workflow adoption, 15.5 avg ops) rather than doing it inline.

Hypothesis: tech-lead fork/dispatch path doesn't have a prompt-level "if this is code change, use implement-and-verify" nudge. Unlike the D-o-R Phase-1 budget fix, this is a *routing* gap rather than a budget gap.

**F2 — Coach weekly promoted-skill regression check lacks a workflow wrap.**

76 ops for a repeatable checklist (3 gym scenarios). This is exactly the shape `gym-batch.sh` addresses — but gym-batch adoption remains zero for coach this session (not even referenced in the 76-op session, per task name).

## Fix Spec

**No dispatch this cycle.** Two reasons:

1. **KE-123**: Don't stack. Prior R1 (cron:project-resume, 18:00 UTC) still in first 24h measurement window. Wait.
2. **Need evidence before dispatching F1.** Recommend next Mode D verify: pull 24h of tech-lead non-workflow sessions >20 ops and classify (refactor vs planning vs other). If ≥50% are refactor/code-change work, that's the dispatch signal.

## Next-check plan (Mode D @ ~04:00 UTC)

1. Re-pull cron:project-resume 24h — target avg ≤15, confirm R1 is durable at scale.
2. **Classify tech-lead 24h non-workflow high-op sessions.** If refactor/code-change dominates, draft a one-line handler-level nudge: when tech-lead dispatches a code-change task, suggest/force `implement-and-verify` on the coder subcall.
3. Re-check coach promoted-skill regression: does it fire weekly? Is a `gym-batch.sh`-wrapped workflow worth building just for that cron?

## Rotation marker

This Mode D cycle. Next rotation: **A (Session Archaeology)**.

[SIG: 1776463400:mode-d-20260417-2200]
