# Session Archaeology — Mode A — 2026-04-17 16:30 UTC

**Window:** last 6h (since 2026-04-17 10:30 UTC)
**Rotation:** A (follows D at 16:00 UTC — workflow-health)
**Budget:** ≤25 ops

## Top-5 by opCount

| # | sessionId | agent | kind/source | ops | task (head) | classification |
|---|---|---|---|---|---|---|
| 1 | s_1776434074191_370 | coach | call/workflow | 62 | `[WORK SESSION] prove-the-loop Iteration 11 — gym A/B for evidence-count-guard` | **INTENDED** (active project iter, gym exploration) |
| 2 | s_1776442914838_479 | tech-lead | job/agents.fork | 61 | `[P0 refactor] Split agents.message into a separate notify tool` | **INTENDED** (explicit P0 from may) — still `running` |
| 3 | s_1776432517875_300 | coach | job/agents.fork | 55 | `[PERSISTENT TASK RESUME] prove-the-loop Iteration 9 — build structural finish-guard` | **INTENDED** (persistent-task, same project) |
| 4 | s_1776438071728_429 | coder | call/workflow | 51 | Workflow-routed (tech-lead HB → coder) `Reference: how an engineer handled...` | workflow-routed, parent HB only 6 ops |
| 5 | s_1776427541234_215 | coach | job/cron | 44 | `[cron:project-resume] …prove-the-loop` | **INTENDED** (project-resume, same project; well below pre-fix spikes) |

## Root-cause scan for top 1–2

- **#1 coach Iter 11 (62)**: gym-scenario search + A/B. Gym-floor cost per 0412 scouting finding (`finding-coach-experiment-cost-scouting-0412.md`). Not waste — it's the cost-of-goods for an experiment iteration. Status `done`, outcome empty but not errored.
- **#2 tech-lead notify refactor (61, still running)**: P0 dispatched from may with a spec at `/tmp/notify-tool.md`. Large surface (tool split across may + leaf-agent wiring). Expected high-op. Not a regression.
- **#4 coder 51 from a 6-op tech-lead HB**: workflow-routed (parent `wr_1776438071726_1ch2`). Heartbeat remained lean (6 ops); the coder child did the build work. This is the **intended** lean-dispatcher pattern working — the op count is moved, not added. No action.

## Regression check vs prior fixes

- project-resume cohort (cron) in this window: sessions 215/399/166 at 44/43/38 ops, all on *same* active project (`prove-the-loop`). Mean 41.7 — higher than the 35.9 baseline from 16:00 finding, but n=3 and all on one deep-stack iter; tiered-budget soft cap (was 10, raised 10→12 per last checkpoint) still lets these project-active resumes breathe. Not a regression signal.
- No non-intended, non-workflow, non-active-project session ≥40 ops observed.
- No `status='errored'` in top-10. No workflow-bypass outliers beyond the coder-under-HB (workflow-routed, expected).

## R1 Decision: **NO_ACTION** (KE-123: don't stack)

Rationale:
- Top-5 all map to intended work (active coach project ×3, intended P0 tech-lead, workflow-routed coder under lean HB).
- Two fixes are still in their measurement window: persistent-task per-iter cap (Apr 17 09:00) and project-resume soft-budget stanza (Apr 17 16:00 dispatch). KE-123 says don't stack — let the signal clear.
- Projected waste from any candidate here is <50 ops/day once the "intended" sessions are removed — under the ≥100 ops/day action threshold.

## Watch-list for next Mode A (22:30 UTC)

- Confirm tech-lead `s_1776442914838_479` (notify refactor) finished cleanly; if it ballooned past ~120 ops, re-classify.
- Re-measure project-resume cron cohort mean; if still ≥40 on non-deep-iter resumes, escalate the soft-budget stanza.
- Watch for new `[cron:*]` agents entering the top-5 (signal of a fresh regression surface).
