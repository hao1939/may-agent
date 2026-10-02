# Default error handling and metrics — archived draft

**Historical context:** [Metrics And Alerts](../../2a-design/metrics.md). Retained rationale and evidence; this record does not define the current contract.

**Design status:** Historical draft from 2026-09-09, paused on 2026-09-10.
The core-metrics classification below was reopened during the subsequent
[discussion](error-handling-and-conversation-discussion-20260910.md). A simple error hook and App subscriber were
preferred for exploration; App placement and consolidation remain undecided.
This retained draft is not an active implementation plan or current core requirement.
**Implementation status:** Existing Task failure handling, metric storage and
reporting supply parts of this design. An isolated live PoC verifies a small
Task-attempt baseline, reporting removal, metric-write failure containment and
restart. The prototype is unpublished; production integration and complete
coverage remain open. See the [measured results](#what-the-live-poc-changed).

## Outcome and scope

Users get useful failure handling and visibility into weaknesses without
assembling those capabilities themselves. Code executes predictable rules and
measures facts. The owning App or LLM judges uncertain causes, alternative
approaches, changes of scope and whether further work is worthwhile.

Two uses share the same execution evidence: keep current work moving or end it
honestly, and improve future work when the avoided cost justifies a change.
Use the [tradeoff rules](../../1-principles/design-philosophy.md#how-to-decide-a-tradeoff).
Recovered failures still matter: eventual success can hide expensive repetition.
For scope decisions, distinguish expected benefit from a best-case ceiling; a
cheaper alternative is still wasteful if its likely benefit does not cover its
remaining cost. Keep material assumptions with the decision.

This design implements the [core baseline](../../2a-design/metrics.md#default-failure-visibility)
within the existing [Task contract](../../2a-design/task-resource-engine.md) and
[event boundary](../../2a-design/events.md). Start at Task-attempt execution, then
extend a proven convention to other execution/admission boundaries. Domain
metrics, dashboards, exporters and specialized analysis remain replaceable.

## Default failure flow

1. Execute the selected operation under the existing Task/attempt authority.
2. On failure, preserve the operation, observed error, useful partial work and
   known external effects in existing attempt/result evidence. Release owned
   resources and retain truthful Task state.
3. Apply a known mechanical response where its preconditions hold. Retry only
   within existing bounds and when repetition is safe. A stale write cannot
   become current merely by retrying it.
4. When the next move needs judgment, provide concise facts to the accountable
   App through existing durable input/wakes. It may repair, change approach,
   wait, revise scope or stop. With no available authorized decision maker,
   retain visible attention and a concrete next action.
5. Record the actual disposition and available cost. Baseline metrics include
   the failure even when a later attempt succeeds.

An unexpected exception reaches the boundary that can take responsibility.
Expected domain outcomes use the existing result/wait forms. Catching errors
throughout every helper, matching free-form exception text to elaborate policy,
and automatically invoking an LLM for every failure would add unnecessary cost.

| Situation | Code handles | App/LLM judges |
| --- | --- | --- |
| Known transient failure | Bounded retry if safe; preserve failed attempts | A different approach if repetition no longer helps |
| Invalid input or unavailable prerequisite | Clear rejection or attention | How to correct ambiguous input or obtain the prerequisite |
| Verification rejects output | Retain evidence and require a changed next move | Repair strategy and whether the original scope remains worthwhile |
| External action may have succeeded | Observe the provider using existing operation identity | How to proceed if ambiguity remains |
| Assigned outcome is infeasible or too expensive | Stop unchanged automatic repetition | Reduce scope, accept partial value, wait or stop |

Scope changes and stops follow the
[owner-decision proposal](../../proposals/task-controller-pattern.md#retry-repair-wait-or-stop).
They must preserve caller expectations and cannot silently mark undelivered
work successful. Infeasibility can satisfy an investigation Task while leaving
a build Task unfulfilled. An unchanged blocker should not trigger repeated LLM
reviews or new sibling Tasks. No new recovery supervisor is required.

## Evidence and baseline measurements

Reuse Task, generation, attempt and event identities. Record facts where they
are known; distinguish observed errors from inferred causes. Keep detailed
diagnostics in linked evidence, with bounded retention. A metric should lead
to representative attempts and relevant source revisions. Avoid a second error
database and high-cardinality labels containing individual IDs or raw messages.

| Question | Initial measurement and meaning |
| --- | --- |
| How often does execution encounter trouble? | Failed and interrupted attempts separately, against a stated finished-attempt cohort; neither state alone identifies the cause; report running work separately |
| What does recovery cost? | Retry attempts and measured elapsed/compute cost; unavailable cost remains unknown |
| Does current work reach a useful outcome? | Actual Task results; keep completed-after-failed/interrupted attempt counts separate, with attention, stopped work and reduced scope distinguished where supported |
| Is a weakness recurring? | Counts and representative evidence grouped by existing error code/operation, App and source revision |
| Can we trust the measurement? | Last successful sample, coverage/window and measurement failures |

A started-within-window cohort excludes older attempts even if they finish
inside the window. A finished-within-window measure answers a different question.
Name the chosen convention and retain old-generation evidence after scope
changes; a new scope is not an unchanged retry.

Count a failure once at its owning boundary; propagation and repeated reads must
not multiply it. Distinct retry attempts remain separate cost evidence. State
the denominator and window: an attempt failure rate and a Task failure rate
answer different questions. Expected negative findings from a successful
experiment are domain results, not execution errors.

The first slice may cover fewer rows, but must identify gaps. Do not infer
reduced scope from prose, fabricate a cost, or count missing samples as zero.
Reuse existing metric samples, units and history. Choose any additional field
only after the PoC demonstrates what cannot be traced with existing records.

## Core activation and failure isolation

Default Host composition supplies failure handling, baseline definitions,
collection, aggregation, history, rule evaluation and basic reads. Apps inherit
the baseline without per-App instrumentation. App-specific measurement and
threshold meanings remain with the App; code evaluates declared rules.

Shared timing owns baseline collection independently of optional App schedules.
Use bounded reads of authoritative attempts/results where possible. Events may
refresh measurements, but passive delivery alone cannot prove complete counts.
Prefer recomputing a bounded window to a new durable telemetry queue. Document
gaps beyond retained source evidence and avoid repeating cumulative values as
new occurrences.

Removing a dashboard, exporter or specialized report leaves core metrics
working. A metric outage is visible degraded core service to repair; it must
not roll back accepted work or block unrelated execution. Expose stale data and
collection errors through bounded diagnostics. Commit one measurement batch
atomically so a failed history write cannot leave a newer current value beside
an older successful-sample timestamp. Reuse retained state when
collection returns; do not recursively emit unlimited metric-failure events.
Core membership does not require synchronous metric writes in Task acceptance.

## From observations to improvements

The owner inspects trends during an existing App review or through a declared
metric route. A red counter alone creates no work. Repeated signals for the
same weakness update one ordinary improvement Task when action is worthwhile.
A single severe failure may justify immediate investigation, while a frequent
but cheap limitation may be accepted.

Inspect examples, compare a fix with simplification or accepting the limitation,
and consider expected future uses, risk, and total cost. Code supplies the facts;
the LLM assesses uncertain causes and choices within its existing authority.
No new permission framework or numeric scorecard is needed.

Verify a chosen fix first against the reproduced behavior, then against a
comparable workload/window. Check recurrence, recovery cost and useful outcomes.
An alert clearing, fewer executions, dropped scope or stopped measurement does
not establish improvement. With no new exposure, operating improvement remains
unproven. Keep a concise reason for accepted limitations and when to revisit.

## Existing code and the smallest change

Source inspected at Host `88598a15`:

| Existing home | Proposed responsibility |
| --- | --- |
| `app-task-runtime.ts`, reconciler and executor adapters | Keep failure handling at the real execution/result boundaries; reuse their evidence |
| `src/lib/metrics.ts` and existing metric tables | Reuse recording, rule evaluation and history as core services |
| `composition/reporting.ts` | Separate its lazy metric service/read/definition wiring from optional outcome reporting |
| `adapters/reporting/metric-read.ts`, `metric-definitions.ts` | Generic metric access/installation belongs with core metrics; App definitions still own domain meaning |
| Shared timing and measurement helpers | Wire a small default baseline independent of optional schedules/reports |

Keep existing files until extracting a coherent boundary reduces coupling.
`core/metrics/` is a suitable eventual home for generic baseline/read helpers;
error handling stays beside its execution owner. Do not create empty directories,
a universal error class hierarchy, a plugin framework or another work queue.

## Live PoC and completion criteria

Use a real isolated Host process with a disposable App, temporary database and
controlled operations. Keep test data separate from installed Apps. Exercise:

1. A recoverable failure followed by success: preserve both attempts and the
   accepted result; expose retry cost instead of erasing the failure.
2. An infeasible operation: stop unchanged retry, expose evidence for owner
   judgment and distinguish a proposed scope change or stop from success.
3. Repeated observations and restart: retain evidence, avoid inflated counts,
   and keep the same work identity.
4. Optional reporting absent and a measurement failure: execution settles;
   baseline reads remain available or explicitly degraded, and recover later.

Use an actual model for a bounded judgment when available. Report separately
what the real Host executed, what the controlled operation simulated and whether
judgment came from a model or a scripted fixture. A model recommendation alone
does not prove the Task-update/termination path applied it.

Start with existing behavior to locate the smallest gap, then implement only
what the trial needs and repeat the affected case. Save commands, revisions,
observations and limitations in a dated PoC record. Polish this design from
that evidence. Full Host integration, broader instrumentation and production
rollout remain separate work; a PoC must not claim those outcomes.


## What the live PoC changed

The [2026-09-09 execution record](default-error-metrics-poc-20260909.md)
contains the portable patch, synthetic evidence and reproduction commands.
A real Host, SQLite, worker processes, control events and local HTTP provider
exercised the Task path. A separate actual model judged a bounded cost packet;
the fixture owner applied the conditional recommendation through App input.

| Observed | Design refinement |
| --- | --- |
| The transient exception became an interrupted attempt with a generic stale-result reason, then succeeded | Preserve observed state, summary and evidence links; do not call a failed-only counter the error rate or infer root cause from the generic reason |
| Recomputing canonical attempts survived replay and restart without inflation | Begin with rolling-window gauges over retained facts; do not add a telemetry queue |
| Two Tasks completed while metric snapshot writes failed; values and history stayed unchanged, then caught up | Keep collection off the acceptance path; commit samples atomically and expose stale service through bounded diagnostics |
| Removing optional reporting and schedules left baseline collection active | Own the baseline in normal core composition and shared timing |
| The model found missing expected-value information; explicit fixture assumptions then supported a smaller deliverable | Treat model output as a recommendation until its conditions and ownership are satisfied; record a new Task generation and acceptance for changed scope |

This validates the direction, not complete core metrics. Before shipping the
slice, bound actual SQLite query work (a row limit alone does not do that),
choose collection/retention costs, expose freshness conveniently, and separate
core definition/rule/read wiring from optional reports. Existing rule evaluation
was not exercised end to end without reporting. Broader error boundaries,
unknown external effects, stopping infeasible work, and automatic App-owner
judgment remain follow-up cases. Add each only when its value earns its cost.
