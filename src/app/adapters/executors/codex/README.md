# Codex goal executor

This is one concrete implementation of the SDK `TaskExecutor` contract.
`daemon-agents.ts` selects it in the shipped executor map; core owns the Task
claim, result acceptance, cancellation and retries.

Read `codex-goal-executor.ts` first. It prepares a fenced attempt, maintains the
existing Task/thread binding and proposes a result to the Host. The other files
keep that backend's responsibilities together:

- `codex-goal-client.ts`: app-server process, requests, turns and cancellation.
- `codex-goal-packet.ts`: attempt context sent to the backend.
- `codex-goal-result.ts`: parsing and validating its proposed result.
- `codex-goal-progress.ts`: passive progress projection to Task-owned events.

The whole execution deadline defaults to 30 minutes. An App's `tasks.maxAttemptMs`
policy (`number | "unlimited" | ((task) => ...)`) can override it per Task with a
positive integer millisecond bound (`1..2147483647`) or `"unlimited"` to permit
an ongoing native goal without an elapsed-time deadline. Omit it (or return
`undefined`) to keep the default. The constructor's `turnTimeoutMs` option sets
the fallback when `attempt.maxAttemptMs` is omitted (`null` for no deadline).

Disabling that deadline does not disable cancellation, app-server exit/error
handling, or native goal completion/blocking. JSON-RPC requests stay bounded;
active-turn startup remains bounded by 30 seconds, a final turn still has
30 minutes to settle, retained turn completions are bounded to the latest 64
turns, and malformed terminal Task results are capped at 3 correction turns per
attempt before failing cleanly. Individual commands and test-run limits are
unchanged.

Progress reporting continues for the attempt's full lifetime. `maxProgressEvents`
(64 by default) bounds the pending publication queue, rather than the total
number of events. A slow store causes older routine observations to be replaced
by newer ones, with lifecycle transitions retained ahead of routine progress.
If the backlog consists entirely of lifecycle events, the newest state wins.
Publication remains serialized; flushing drains retained observations. Recent
deduplication keys are bounded, while durable event keys preserve idempotency
when older observations are replayed. No reporting timer needs cancellation.
The runtime's accepted Task state remains authoritative; backend thread state
is execution evidence. Removing this executor leaves its work visibly
unavailable under the existing recovery contract while other executors remain
usable. Drain active execution before removing a backend.

Colocated tests cover process bounds, bindings, exact-turn results, progress and
stale ownership. `codex-goal-fencing.test.ts` exercises the Host boundary.

`bun run check:codex-goal-protocol` exercises the production client against the
installed Codex CLI and a loopback Responses fixture. It checks paused-goal
notification and persistence, captures the actual outgoing request, restarts and
resumes the process, inserts a fresh canonical attempt packet (including exact
revision, input key, and prior rejection), and checks that an active new turn
rejects steering addressed to the old turn. It uses disposable state without
inherited credentials or an external model call. The image smoke test runs this
check with the shipped CLI as the runtime user.

This tests the production client protocol behavior May uses for restart/resume
and fresh request context. Task starts and resumes omit a sandbox override so the
installed CLI configuration owns execution policy; the Task/App acceptance still
defines authorized intent, and an explicit client sandbox remains supported.
It does not run the complete executor orchestration
or test tool execution, live provider recovery, or Codex compaction: no
deterministic portable compaction trigger is available in this fixture. Keep
the colocated executor, turn, error, and cancellation tests and review upstream
release changes when upgrading the pinned CLI. Generated schemas can help
investigate a failure; whole-schema fingerprints are not a compatibility
contract. See the
[official app-server documentation](https://developers.openai.com/codex/app-server).
