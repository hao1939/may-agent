# Meaningful events verification — 2026-10-05

This verifies the producer corrections described in [Events](../2a-design/events.md)
and the App review policy in [Task outcome evaluation](task-outcome-evaluation.md).
The trials use real Host components with temporary SQLite databases and controlled
provider results. They make no model calls and do not change live Task state.

| Contract | Result |
| --- | --- |
| Quiet Task checks preserve recovery | The indexed scheduler recovers the exact missed answer and invokes its owner once; repeated pending checks invoke no agent and emit no Task update. |
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
should stop generating Task records; XHS facts should correspond to open demand;
real failed publication and provider error evidence must remain visible. Old
records remain historical evidence. The separate durable-admission recovery fix
still owns retrying a publication that failed to reach its consumer.
