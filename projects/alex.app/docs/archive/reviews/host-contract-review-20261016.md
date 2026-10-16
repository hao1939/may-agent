# Host contract review — 2026-10-16

**Status:** Dated source review and isolated trials; no runtime changes or rollout.
**Supports:** [Host improvement proposal](../../proposals/host-contract-improvements-20261016.md).
Current authority remains the [Host/App boundary](../../2a-design/system-boundary.md)
and its linked contracts. This record preserves why the follow-ups were proposed.

The [two-week commit review](host-two-week-design-review-20261016.md) adds recurring
design lessons and proposal coverage. Its source-history review does not change
the test counts or runtime-evidence limits recorded here. The later
[contention implementation trial](host-contention-fix-20261016.md) records the
first source correction and its separate verification results.

## Scope

Host tests ran at `6c4f4e23d0edc7ff292ad44fb24777b55c4bbe47`, including #364–#367.
A later fetch found `ff3449013a77a9a79ca0c877e0a7c090f5d51228`, merging #363;
that four-file delta was separately source-reviewed, not included in these test
counts. Documentation baseline was Apps `3ca6dd6f72aba4a408b6afdd61442cc17662576c`.

The review covered principal Task, delivery, persistence, observation, failure,
recovery and extension boundaries. It was not a line-by-line audit of every
module. No live App state changed, no external models ran, and no production
database profiling or deployment verification occurred.

## Findings and evidence

| Boundary | Observed behavior | Practical limit of the finding |
| --- | --- | --- |
| Database contention | Two real SQLite connections reproduced about 1.73 seconds inside a contended write and 1.74 seconds of delay to a zero-delay timer. A 50 ms busy timeout is compounded by synchronous waits of 5–640 ms | Demonstrates serving-loop blocking; production frequency and token cost unmeasured |
| Ordinary observer facts | Successful `AppObserver.run()` publication with normal App routing but no interested consumer became `unhandled`, metric value 1, while observer health succeeded | Resource observers already project observation selectors. May metric evidence uses that path; its live GitHub facts target Tasks. The generic probe does not establish current May waste |
| Receipt expiry | At +180 seconds the same kind of input became `unhandled` without restart but remained `pending` after writer/storage reopen | Both retained `app_admission_pending=1`. Independent admission recovery could still succeed; permanent loss was not demonstrated |
| Recovery result | Private `interrupt()` documents its boolean as session-projection reconciliation. #363 makes claim release require confirmation; startup and terminal-session retry treat it differently | Failed process drain, live external owner, corrupt metadata and known binding mismatch already throw. Missing metadata can return false after draining persisted shell groups. No overlap incident was demonstrated |
| Metric query | A correct synthetic recursive query over two million rows delayed a zero-delay timer by about 310 ms | Shows synchronous execution can block; no installed App query latency was measured |

Pinned source entry points:

- [Busy retry helper](https://github.com/hao1939/may-agent/blob/6c4f4e23d0edc7ff292ad44fb24777b55c4bbe47/src/lib/db/busy-retry.ts)
  and [receipt expiry](https://github.com/hao1939/may-agent/blob/6c4f4e23d0edc7ff292ad44fb24777b55c4bbe47/src/lib/db-writer.ts#L1178).
- [Ordinary observer publication](https://github.com/hao1939/may-agent/blob/6c4f4e23d0edc7ff292ad44fb24777b55c4bbe47/src/app/adapters/producers/app-observer-runtime.ts#L147)
  and [observation selectors](https://github.com/hao1939/may-agent/blob/6c4f4e23d0edc7ff292ad44fb24777b55c4bbe47/src/app/core/reads/app-contract.ts).
- [Recovery interface](https://github.com/hao1939/may-agent/blob/6c4f4e23d0edc7ff292ad44fb24777b55c4bbe47/src/app/core/tasks/execution.ts),
  [session adapter](https://github.com/hao1939/may-agent/blob/6c4f4e23d0edc7ff292ad44fb24777b55c4bbe47/src/app/adapters/executors/session-recovery.ts#L145),
  and post-#363 [startup](https://github.com/hao1939/may-agent/blob/ff3449013a77a9a79ca0c877e0a7c090f5d51228/src/app/core/tasks/app-task-runtime.ts#L1179)
  / [terminal-session retry](https://github.com/hao1939/may-agent/blob/ff3449013a77a9a79ca0c877e0a7c090f5d51228/src/app/core/tasks/attempt-runner.ts#L142).
- [Metric SQL execution](https://github.com/hao1939/may-agent/blob/6c4f4e23d0edc7ff292ad44fb24777b55c4bbe47/src/app/metric-source-measurement.ts#L241).

Additional source findings: [database opening](https://github.com/hao1939/may-agent/blob/6c4f4e23d0edc7ff292ad44fb24777b55c4bbe47/src/lib/db/connection.ts#L48)
may restore a backup on an empty catalog or broad read failure; accepted-state
loss was not reproduced. The [model registry](https://github.com/hao1939/may-agent/blob/6c4f4e23d0edc7ff292ad44fb24777b55c4bbe47/src/app/model-registry.ts#L74)
chooses a concrete fallback; the adapter switches once on immediate expired IDE
credentials and tries the primary on the next request. This is not permanent
fallback. [SDK retry defaults](https://github.com/hao1939/may-agent/blob/6c4f4e23d0edc7ff292ad44fb24777b55c4bbe47/packages/sdk/src/app.ts#L437)
have advanced beyond the reviewed unlimited/250 ms documentation.

## Validation and retained material

**285 existing tests passed across 13 files**, covering transactions, observer
publication, schedules, session recovery, recovery scheduling, Events and
delivery, Task lifecycle/retry exhaustion/startup, direct Event recovery and
Task worker-process integration. **Six observational probes passed** by asserting
current behavior, including defects; passing does not mean those defects are fixed.

The original local review retains the full report, test/probe logs and #363 patch
in the Apps checkout's ignored `.state/host-systemic-review-20261016/` directory.
The isolated Host review worktree retains `.state/systemic-review.test.ts`;
it ran with `bun test ./.state/systemic-review.test.ts`. These are local artifacts,
not portable committed test coverage. Implementation must add its regressions
to the owning suites. Full CI, complete #363 validation, real-backend recovery
contract changes, live model behavior and backup-loss trials remain unperformed.
