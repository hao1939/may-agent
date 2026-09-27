# Codex goal executor

This is one concrete implementation of the SDK `TaskExecutor` contract.
`daemon-agents.ts` selects it in the shipped executor map; core owns the Task
claim, result acceptance, cancellation and retries.

Read `codex-goal-executor.ts` first. It prepares a bounded attempt, maintains the
existing Task/thread binding and proposes a result to the Host. The other files
keep that backend's responsibilities together:

- `codex-goal-client.ts`: app-server process, requests, turns and cancellation.
- `codex-goal-packet.ts`: attempt context sent to the backend.
- `codex-goal-result.ts`: parsing and validating its proposed result.
- `codex-goal-progress.ts`: passive progress projection to Task-owned events.

The runtime's accepted Task state remains authoritative; backend thread state
is execution evidence. Removing this executor leaves its work visibly
unavailable under the existing recovery contract while other executors remain
usable. Drain active execution before removing a backend.

Colocated tests cover process bounds, bindings, exact-turn results, progress and
stale ownership. `codex-goal-fencing.test.ts` exercises the Host boundary.

`bun run check:codex-goal-protocol` exercises the production client against the
installed Codex CLI. It initializes a thread, saves a paused goal, observes its
notification, restarts the process, and reads the same thread and goal. It uses
disposable state without inherited credentials or a model call. The image smoke
test runs this check with the shipped CLI as the runtime user.

This tests the protocol behavior May uses for setup and persistence. It does
not test model turns, tool execution or live provider compatibility. Keep the
colocated turn/error/cancellation tests and review upstream release changes when
upgrading the pinned CLI. Generated schemas can help investigate a failure;
whole-schema fingerprints are not a compatibility contract. See the
[official app-server documentation](https://developers.openai.com/codex/app-server).
