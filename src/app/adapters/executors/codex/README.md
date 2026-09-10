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
stale ownership. `codex-goal-fencing.test.ts` exercises the Host boundary. Protocol
compatibility fixtures remain in `scripts/poc/`; they are not live model proof.
