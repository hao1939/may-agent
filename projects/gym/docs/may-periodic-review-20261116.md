# Daily May improvement review — 2026-11-16

**Historical setup; May-only selection superseded.** The same standing Task now
uses the accepted [system-wide review policy](system-periodic-review-20261116.md).
Alex chooses across agents, Apps, workflows, benchmarks, tools and the improvement
process; May has no default priority. The original setup and audit below retain
their historical scope. The Task identity, daily 09:00 UTC deadline and cumulative
incident limits are unchanged.

Status: standing Alex Task accepted and waiting; first review deadline verified
in canonical Host state. The user authorized making the completed pilot periodic.
The initial cadence is **daily at 09:00 UTC**, with the first due review on
**2026-11-17 at 09:00 UTC**.

| Setting | Accepted state |
| --- | --- |
| Owner / target | Alex / May |
| Standing Task | `alex/input/app_82bccb7e-cdab-4ea4-875b-7d99945fec93` |
| Admission event | `6726807` |
| Accepted setup attempt | `r_1_2dd0cbeb-311c-4e3b-bc83-cd153124b38a` |
| Current state at setup verification | waiting, generation 1, resourceVersion 6 |
| Host deadline | `1794906000000` = `2026-11-17T09:00:00Z` |
| Timing mechanism | Same standing Task's top-level `reviewAt` |

The [control-plane operation skill](../../../shared/skills/control-plane-operation/SKILL.md)
and the [Task execution guide](../../alex.app/docs/2b-manual/task-execution-guide/SKILL.md)
provide the existing admission and Task-owned deadline mechanisms. No App
schedule, cron job, source activation, deployment or Host restart was added.
The earlier finite pilot remains closed. The accepted result retains standing
responsibility and the exact deadline both on the Task and its original input
wait, with no synthetic Condition or immediate `continue` loop.

## Assigned recurring behavior

- Start from changed May evidence, with at most ten May subject requests and
  three supporting Alex records per review. Reuse accepted evidence and fitting
  existing work; avoid rediscovering old Alex report Tasks or repeating the
  same no-change investigation.
- Alex selects at most one useful attributable delivery/efficiency problem,
  carries justified local work to its supported boundary, or records no-change
  or insufficient evidence. No candidate or benchmark is needed to fill a day.
- Retain one active incident across days, its exact evidence, next action and
  cumulative allowances: at most two new whole-benchmark runs, one development
  invocation and three automated review/repair rounds **per incident**. A new
  day or attempt does not reset them. Existing plan/truth gates also apply.
- Keep unchanged evidence quiet, with no helper, benchmark, development work or
  human notification. The daily owner wake itself can still consume model tokens.
- After each observation, rearm the same Task for the next future 09:00 UTC.
  Early unrelated wakes preserve the deadline; missed days do not produce a
  backlog of duplicate reviews. These later behaviors remain to be observed.

Production May instructions and Host source remain unchanged. Candidate work is
isolated; automatic publication, merge, production application, label approval
and baseline promotion are outside this recurring assignment. Alex remains
responsible until the user/operator changes or withdraws the standing scope.

## Setup verification and observation

Setup reused the closed pilot without running another investigation, helper or
benchmark. The accepted attempt lasted **76.014 seconds**. Its one Alex session
has eight replies with usage/cost estimates totaling **$0.4644896**; billing and
operator effort are unknown. This is separate from the preceding pilot's cost.

The [setup audit](agent-reports/may-periodic-review-20261116.json) binds admission,
canonical waiting/deadline state, the checkpoint and final setup-session usage.
All 5,318 inventoried prior hashes and frozen input copies matched. May source
is unchanged and the separate Host repository remains clean.

The [accepted status receipt](/app/.state/gym-may-periodic-20261116/status.json)
and [checkpoint](/app/.state/gym-may-periodic-20261116/alex-evidence/setup-checkpoint-20261116T1246Z.json)
are retained snapshots. Read `app.task.get` for App `alex` and the standing Task
ID above to observe current state, `currentObligations.reviewAt`, latest accepted
attempt, decision, checkpoint and cumulative incident counts. They are the
canonical observation route; the local setup snapshots do not refresh themselves.

Only setup and the persisted first deadline are verified. No due-day wake,
subsequent rearming, restart recovery or general recurring reliability has been
observed. The checkpoint's setup-time cutoff is not proof of exhaustive subject
inspection: the first due review must retain bounded coverage and deduplicate
actual evidence rather than silently skipping earlier unseen records. Durable
automatic cumulative-budget enforcement remains unproved; the retained owner
counts and single-invocation bound contain that known gap.
