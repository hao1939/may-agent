# Explicit Condition freshness — November 12, 2026

**Status:** Implemented and checked in [Host PR 456](https://github.com/hao1939/may-agent/pull/456),
pending merge and installation. This is source evidence, not deployed behavior.

**Owns:** Follow-up to finding 2 in the
[resource/Event boundary review](resource-event-boundary-20260927.md) and the
[September 30 observation review](task-observation-contract-20260930.md).
The accepted contract remains [observation validity](../../2a-design/events.md#changes-that-already-happened).

The old matcher treated `.state`, `.check`, `.pulse`, `-pulse` and one named domain
event as current observations. Other names could accept the same historical fact.
Meaning therefore changed with spelling, and a missing timestamp bypassed the check.

The current matcher uses the Condition's existing expectations. A raw historical
result Condition needs no time boundary. A fresh read declares numeric
`expected.timestamp: { gte: requestedAt }`. SDK `observationCondition`, including
the `tasks.contract` construction path, adds that boundary and the exact observer
source. Explicit timestamp expectations override the default. Retain a constructed
Condition when continuing the same wait; reconstruct it when requesting a new read.
No new Condition property, watcher service or global event taxonomy is introduced.

Envelope time cannot come from a payload field named `timestamp`. Persistence
fills missing envelope time from the Host clock, preserves valid producer time,
and exposes the same value to live routes and journal recovery. A fresh resource
read does not prove a new measurement: callers still require `measuredAt`, sample
identity, revision or other provider facts when needed.

Resource schema v4 converts old stored name-dependent waits once, using their
saved `status.observedAt`. Condition IDs, generations, observations, Task links,
input waits and accepted results survive. Resource versions and snapshot revision
advance for the rewrite. Pending settlement reports retain their other effects;
unchanged waits use their saved boundary and newly proposed waits use upgrade time.
Existing numeric constraints are intersected. An unrepresentable timestamp
contract stops and rolls back the upgrade with the offending Condition identified.
The operator must resolve that declaration before reopening with the new Host.
Upgrade with the old runtime stopped; raw App declarations relying on the old
name rule need explicit expectations. Subsequent reopen does not reapply name policy.

Source baselines: Host `c5c163aafcc1` (#454), Apps `f1f2af58292d`.
Candidate Host: `211c5fb2b8`. Apps companion changes are docs and regression
updates for May's GitHub wait and Scout's credential wait; production callers
already use the SDK helper. Install matching Host/SDK together. Old installed
source and existing live state were not converted for this work.

Portable validation: Host `check:ci`, 13 dedicated freshness regressions and the
complete `MAY_TEST_SHARDS=4 bun run ci` gate; May's 187 tests and typecheck; Scout's
81 workflow tests; both GitHub composition checks; and the full Apps design check.
Exact Host gate results are recorded in the PR. The initial high-concurrency run
also hit a synthetic workflow's one-second timeout; the final run uses CI's four
shards.

HTTP responses and owner decisions in the GitHub compositions are fixtures.
These checks do not prove live GitHub behavior, model judgment, a container rollout
or installation recovery. Workflow kernel and prompt/checker changes are outside
this slice. Runtime matching shrinks; total source grows because the bounded
upgrade and regression coverage preserve existing state.

## Review follow-up: one interpretation during recovery

Review of Host `211c5fb2b8` found a real gap in the implementation and the evidence
above. The initial tests covered persisted-event reads, but did not exercise the
actual `recoverTaskConditions()` path with a producer time different from storage
time. An event produced at 1000 and published at 3000 failed a cutoff of 2000 live,
then incorrectly satisfied it after restart. Recovery had a second decoder that
substituted the SQL publication time, dropped envelope targets and read the compact
body projection without checking the complete saved evidence.

The contract stays explicit; the implementation removes that competing decoder.
Condition recovery now reuses the existing persisted-event loader, retaining its
bounded candidate query and normal Condition transition. The loader validates
the saved envelope and verifies complete inline or artifact-backed bodies.
Pre-envelope history retains the known publication time; damaged current records
are skipped as proof. Keyed retries also use the existing envelope validator,
rather than extracting a possibly invalid timestamp with SQL.

Seven new regressions exercise actual Task declaration, deferral and Condition
recovery across file-backed database reopen: stale and fresh evidence, an
independent human wait, historical proof, repeated recovery, complete large bodies,
envelope-only targets, four damaged-evidence cases and pre-envelope history.
All seven fail against the earlier duplicate decoder. A keyed-retry regression
also rejects a damaged saved timestamp instead of publishing with a newer time.

Follow-up Host: `2ddc5d77d9`. Focused freshness/recovery/persistence/transaction
suites passed 34 tests; affected Task runtime and observation suites passed 218.
May typecheck and all 187 tests passed against this candidate, as did the complete
Apps design check and both fixture-backed GitHub compositions. Final full Host
CI and hosted check results are recorded in the linked PR. This follow-up adds no
SDK API, freshness mechanism or broader replay scope, and performs no deployment.
