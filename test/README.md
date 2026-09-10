# Test coverage ownership

The portable gate is `bun run ci`. Tests exercise the current Host contract;
App policy and installed configuration belong to their owning App/deployment
checks. Directory names alone do not indicate test cost or isolation.

| Contract | Detailed owner | Distinct integration protection |
| --- | --- | --- |
| Task claims, waits, completion and stale results | Reconciler and resource-store tests | Real concurrent connections, restart, process workers and cancellation |
| Task prompt/catalog projection | `app-task-runtime-policy.test.ts`, with no disk setup | Runtime tests verify persisted waits and actual agent inputs |
| Workflow execution allowances, cancellation and bounded effects | `src/lib/workflow-tool.test.ts` | `test/integration/workflow-tool.test.ts` owns tool dispatch, session reuse and steering; daemon discovery checks persisted runs |
| Metrics and alert transitions | `test/integration/metrics.test.ts` | E4 proves event ingress, handler registration and persistent alert recovery |
| Startup and recovery order | `app-runtime.test.ts` and `composition/background-startup.test.ts` call isolated production-code probes; `core/tasks/startup-recovery.test.ts` owns session eligibility | `task-startup-no-schedules.test.ts` runs real daemon/socket/worker restart; registry and Task runtime tests own atomic publication/rollback |
| Shutdown decisions | `test/integration/shutdown.test.ts` calls production lifecycle/signal handlers with intercepted process effects | Real daemon teardown and process lifetime tests |
| Browser rendering | E8 executes served `chat.js`, including raw/Markdown streaming and safe fallback | Same browser checks the project-comment HTTP journey |
| Bounded execution imports | ESLint restricted imports | SDK exports, execution results and shipped artifacts retain their own tests |

Startup probes are child processes so module mocks cannot leak across test
files. They run actual startup, registry/inbox and socket code, but replace
external Telegram/Console effects and indefinite loops. Recovery probes hold
the real startup caller's recovery dependency pending, then settle it. They do
not claim live Telegram, model, or deployed-App acceptance.

## SDK export contract

The SDK root test runs the installed compiler CLI and compares its emitted
`index.d.ts` with `test/fixtures/sdk-root.d.ts.snap`. This checks explicit value
and type-only exports without importing the compiler API. Compilation errors,
missing output, and declaration changes fail the test. Review intentional
export changes before updating the baseline; declaration ordering and compiler
formatting changes also require review. Keep root exports explicit: a wildcard
would hide transitive export changes from this check. This is an export-surface
check, not a snapshot of every referenced type's definition.

## Retired historical checks

The test audit identified 59 copied or obsolete cases. Their disposition:

- Two-phase workflow parser (13) and shallow heartbeat (4): removed; those
  copied policies are not implemented by the current Host.
- Copied web renderer (9): replaced by checks of shipped code in E8.
- Copied shutdown routine (6): replaced by real lifecycle handler checks.
- Telegram enrichment/notification SQL (9): removed copies; actual adapter
  input identity and reply routing remain in transport and Telegram E2E tests.
- Pivot counter simulation (3): removed the test-local Map algorithm; actual
  helper/guard contracts remain. No obsolete blocking policy is reintroduced.
- Digest recovery/escalation decisions (15): removed copied orchestration;
  real digest reads, stuck classification and circuit breaker tests remain.

Source-string startup checks have been replaced by observations of execution.
The shipped entrypoint configuration check and SDK public-export checks stay:
they inspect artifacts that are themselves the contract. Obsolete singleton,
delivery-gate and polling identifiers are not behavior specifications.

Related fixture cleanup keeps fresh state per test: model data comes from
`fixtures/model.ts`, accessors share a manager suite, pure rules avoid disk,
and runtime setup seeds the intended store directly. Storage restart and
multi-connection tests remain file-backed. Do not trade these guarantees for
a smaller count or a faster-looking skipped suite.
