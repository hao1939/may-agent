# Work Graph V2 Live Shadow Report — 2026-07-16

Status: Slice 0/1 review evidence; read-only

## What Was Run

The app-local snapshot CLI read the live task tree, reviewer ledger, three loop
ledgers, referenced runtime sessions, and recent delivery facts. It hashed all
file inputs before and after capture. No app route, schedule, health consumer,
metric, watchdog writer, planner writer, or task state was changed.

Focused replay result:

```text
7 pass
0 fail
19 assertions
```

Live capture at `2026-07-16T05:01:50.068Z`:

```text
frontier: runnable=1 waiting=0 active=3 review=7 blocked=121
parity: compatible; blocked(current-truncated; v2-only=101, current-only=0)
mirror: active=false review=false waiting=true runnable=true
invariants: active-attempt-missing=1,
            review-decision-not-applied=5,
            review-delivery-missing=1
read-only: verified
```

The immediately preceding capture had `active=4`, `review=6`, and
`waiting=1`. That movement while the CLI remained read-only is useful: the
snapshot is observing the actively reconciled project rather than a frozen
copy.

## Explained Differences

### Blocked frontier: compatible truncation, not semantic drift

V2 returns the complete blocked leaf set (`121`). The SDK
`summarizeTaskTree` applies `.slice(0, 20)` to all frontier arrays, so its
blocked projection contains 20 members. Every legacy member exists in V2 and
there are no legacy-only members. The comparison now reports this separately
as `current-truncated`; it does not claim exact parity.

### Stored root readout: genuine mirror drift

The runnable and waiting mirrors matched at capture time, but active and review
did not. The V2 frontier is derived from task state and relationships, while
`current_root_readout` is treated only as an asynchronously maintained mirror.
This is the drift class that currently creates root-readout repair work.

Expected V2 change: consumers move to the derived snapshot. The mirror repair
writer is retired only after all consumers cut over.

### Attempt/review findings: useful shadow candidates, not authorized repairs

The snapshot found one active task without a viable runtime session/fresh loop
heartbeat, five reviewer decisions not yet reflected in task state, and one
review beyond the delivery grace window. In Slice 1 these are observations
only. They must be correlated by revision before any supervisor is allowed to
recover or re-emit them.

This validates the migration order: adding supervisor actions before Slice 2
would risk applying a late result to changed task intent.

## Design Versus Current Implementation

| Boundary            | Current implementation                                                          | V2 shadow evidence                                                        | Expected migration effect                                                                  |
| ------------------- | ------------------------------------------------------------------------------- | ------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------ |
| Frontier            | SDK summary plus app suppression plus copied readouts                           | Full derived frontier; legacy cap explained; mirror drift visible         | One read model; delete readout repair loops after consumer cutover                         |
| Attempt liveness    | Watchdog combines session state, loop heartbeat, grace, and wake policy         | Runtime projection is separate from invariant/action policy               | Fewer false stale wakes; revision-safe recovery                                            |
| Review continuation | Reviewer ledger and planner/watchdog replay branches                            | Missing versus decision-not-applied are distinct                          | One continuation invariant and one idempotent command path                                 |
| Waits               | Blocked tasks contain loosely normalized observer/timer/fallback metadata       | Blockers normalize into Condition candidates with missing fields explicit | Exact condition identity and one observer/fallback owner                                   |
| Controller residue  | Controller roots copy ledger progress; watchdog/stall review infer gaps         | Controller snapshots expose reported unrepresented count                  | Ledger-owning controller reconciles; supervisor only pulses broken representation          |
| Recovery            | Planner, watchdog, stall review, metrics, readout sync, and ops scripts overlap | Stable typed recovery keys are produced without mutation                  | One narrow supervisor for process invariants; normal domain outcomes stay outside recovery |

## Gate Assessment

Slice 0 is represented by the deterministic replay manifest in
`test/fixtures/work-graph-v2/README.md` and the existing current-behavior
tests it references.

Slice 1 has passed the focused pure/read-only tests and live file-hash check.
Before enabling mutation, remaining work is:

1. expose source generation/freshness in the concise report;
2. compare health/controller projections explicitly, not only task summary;
3. retain these live mismatches as expected shadow evidence;
4. implement revision correlation and prove stale results are audit-only.

No cutover is approved by this report.

## Concurrent Capture Follow-up

A later capture explicitly compared the health projection as well as the task
summary. The live tree/reviewer inputs changed while the independent legacy
readers ran. The first CLI version printed `read-only: FAILED`; this was a
reporting defect, not a write. Hash changes cannot attribute an external live
writer to a read-only observer.

The report now separates:

- `readOnlyByConstruction`: the CLI opens SQLite read-only and invokes no
  mutation API;
- `stableInputs`: authority-file hashes remained equal around the capture;
- `concurrent-input-change`: parity across independently read generations is
  inconclusive and cannot be used as a migration gate.

The isolated CLI fixture remains the no-concurrency proof: every hashed input
is byte-identical before and after capture. A live exact-parity gate will use
the planned brief writer freeze or a single versioned snapshot boundary.
