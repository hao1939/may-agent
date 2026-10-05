# Meaningful events verification — 2026-10-05

This verifies the producer corrections described in [Events](../2a-design/events.md)
and the App review policy in [Task outcome evaluation](task-outcome-evaluation.md).
The trials use real Host components with temporary SQLite databases and controlled
provider results. They make no model calls and do not change live Task state.

| Contract | Result |
| --- | --- |
| Quiet Task checks preserve recovery | The indexed scheduler recovers the exact missed answer and invokes its owner once; repeated pending checks invoke no agent and emit no Task update. |
| Checks remain measurable | 1,002 reported checks produce one sample: 1,001 skips in five minutes = 200.2 checks/minute, with raw counts and three exact recent Task references. Worker results carry this evidence without additional events. |
| Collection delay does not fabricate a regression | 100 checks in five minutes and 300 checks in fifteen minutes both report 20 checks/minute. With no elapsed interval, counts stay pending. |
| Alert evidence explains the decision | With an illustrative App-owned 30-minute mean and minimum three samples, a single spike causes no breach; sustained activity causes one breach and later zero samples produce one recovery. The evidence read returns both raw samples and the calculated value at its cut. |
| XHS observes open demand | Three scans without a wait perform zero browser probes. Three unchanged blocked polls add no new observation. |
| A new wait can use the same external value | After one ready wait completes, a second wait for the same XHS resource receives fresh ready evidence and becomes runnable. The human login action remains attached to the Condition. |
| Failure reports describe changes | Three identical failures produce one notification. A changed error produces another. Success clears current health; recurrence is reported again. A failed publication, including one without a durable receipt, retries. |
| Optional diagnostics preserve real failures | One lost publication contributes one unhandled signal. Its subscriber-failure diagnostic remains retained and contributes one subscriber failure, without doubling the unhandled signal. |
| Broad review does not reduce Task coverage | Population review uses daily cuts; the next hourly selector pass still selects ordinary Task work. Changed evidence at the next daily cut remains reviewable. Existing failure and metric transition routes remain independent. |

The XHS composition trial produced three facts: initial blocked access, readiness,
and fresh readiness for the second wait. The old watcher produces ten identical
ready events over ten ready checks. This comparison establishes publication
behavior, not live token savings or browser-provider reliability.

Validation includes the Host observer, event-bus, metric, Task recovery and control
contracts, the App's actual XHS Condition and detector, and 212 App regression tests
covering retained evidence identity, metric episode identity, ordinary selection,
source publication and browser access. Design integrity and example checks pass.

Deployment verification should compare new events after activation: quiet checks
should stop generating Task records and appear in `task.skipped-check-rate`
samples instead; XHS facts should correspond to open demand;
real failed publication and provider error evidence must remain visible. Old
records remain historical evidence. The separate durable-admission recovery fix
still owns retrying a publication that failed to reach its consumer.

Check counters are best-effort activity evidence, not an exact execution audit.
Long-running workers report at completion; lost workers or a Host restart can
lose unsampled counts. Failed sample persistence retains counters for the next
ordinary pass. No skip-rate alert is enabled before App-owned calibration.

These trials establish accounting, quiet sampling and configured transition
behavior; they do not establish that any skip rate is wasteful or select a
production threshold. The first deployed review should compare exact Tasks,
workload and measured effort, using the existing Evaluation workflow.
