# Metric transitions instead of repeated breaches

**Status:** Isolated source verification, October 3, 2026. No live model call,
runtime restart, deployment, Task mutation or database migration.

**Contract:** [Metrics and alerts](../../2a-design/metrics.md).

## Question and source

Can metric observations remain available without commissioning more work for
changed values inside the same open alert?

Host baseline: `d101f08d7` (merged #299). Candidate: `bdc4d9023` on
`fix/metric-transition-events-20261003`,
[PR #300](https://github.com/hao1939/may-agent/pull/300). The comparison uses Apps source
`f694899123`, invoking real Evaluation and Scout subscription mappings with
automatic Evaluation enabled for the isolated process. It does not invoke agents.

The Host change removes the repeated-breach emission from `MetricService.evaluate`
and makes `alert()` return after updating an already-open alert. Current samples,
alert identity and latest alert text remain stored. There is no new queue, cache,
schema or Task rule. Existing repeat filters remain useful for old retained events.

## Before and after

For a synthetic Scout metric with threshold `>0`, record and evaluate
`[0, 1, 2, 3, 3, 0, 4]` through the real metric service:

| Result | Baseline | Candidate |
| --- | ---: | ---: |
| Retained samples | 7 | 7 |
| Breach events | 4 | 2 |
| Repeated breach events | 2 | 0 |
| Recovery events | 1 | 1 |
| Evaluation inputs | 3 | 3 |
| Scout owner inputs | 4 | 2 |

The first breach and recovery share an alert ID. Rebreach creates a different ID.
Scout subscribes to breach, while Evaluation subscribes to breach and recovery.
Evaluation already filtered repeated breaches, so its input count is unchanged.

Two further identical manual `alert()` calls in the still-open episode emitted
two unmarked breaches in the baseline and no additional events in the candidate.
The baseline routed both calls to both Apps. The candidate updated the existing
alert without additional input. Distinct manual evidence updates retain the
latest message/facts, not a separate history of every manual message. Required
new work and explicitly requested reassessment use ordinary App input.

## Regression verification

The two updated integration tests failed on baseline behavior: automatic and
manual repeats each emitted three breaches where one opening was expected.
Both passed with the candidate. The existing metric/evidence selection passed
all 12 tests, including evidence windows and accepted decision provenance.

The transition regression also closes the database connection and creates a new
service before reevaluation. The open episode stays quiet without in-memory
suppression. It verifies every saved sample, current value, resolution timestamp,
and the new alert ID after recovery. The manual regression crosses manual/source
evaluation within one episode, checks updated facts, and verifies that manual
resolution permits a later new opening.

Portable owner checks from the Host checkout:

```sh
bun test ./test/integration/metrics.test.ts ./src/app/adapters/reporting/metric-evidence.test.ts
bun run ci
```

Common design checks use `bun run check:may-design` from the Apps checkout.
Final full-CI status belongs to the Host PR; the checks above are reproduction
commands, not a deployment receipt.

## Review correction: persist the transition with its event

PR review identified a failure the initial happy-path comparison did not cover:
if required Event persistence failed after alert creation, the row stayed open
and the next attempt suppressed an opening that had never been published. The
same sequence could lose a recovery after setting `resolved_at`.

The correction at Host `6aac653d1` uses the existing `stateTransaction` around each automatic
opening, manual opening and measured recovery. `DbWriter` already joins that
transaction. No new retry state or Event infrastructure is added, and a failure
does not roll back successful transitions for other metrics.

Three regression cases inject an SQLite insert failure through the real EventBus
and DbWriter. All three failed against the initial PR. With the correction, the
alert mutation rolls back, the sample stays stored, no subscriber runs, and the
ordinary retry commits and delivers the transition once. A subsequent repeated
call stays quiet. The focused metric, Event-writer, evidence and source-collection
checks passed all 37 tests. The PR records the final source and full-CI result.

## Value and limits

The verified gain is fewer events and unnecessary input admissions. The latest
Evaluation route already filters repeats, so its immediate gain is reduced
routing work, not fewer assessments in this sequence. No token-cost or model
quality improvement was measured.

Manual resolution and disabled-alert handling retain their quiet administrative
behavior. The inactive stall path is outside this correction. Retained old sample
waits require separate owner judgment; the change does not silently remove them.
It also does not solve overload from distinct requirements arriving faster than
work can complete. Routine metric review remains responsible for continuing
concerns; a recorded recovery does not fulfill the original request.
