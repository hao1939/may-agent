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
compatibility verification uses `bun run check:codex-goal-protocol` and the
`scripts/codex-goal-protocol*` fixtures; it is not live model proof.

The snapshot was reviewed against generated schemas from Codex 0.154.0 and
0.156.1. Eleven of the 22 tracked files changed: image inputs now also accept
file IDs, replies can include MCP presentation and saved plugin/collaboration
settings, and personality/rollback descriptions changed. Existing image URL
forms remain accepted. May sends text inputs, supplies instructions directly,
does not call rollback, and reads specific response fields; these changes need
no client adaptation. Goal set/get, interrupt, and goal-update notification
schemas are unchanged.

Keep the version and reviewed hashes together when upgrading the container CLI.
Generate schemas from both versions as described in the [official app-server
documentation](https://developers.openai.com/codex/app-server#message-schema);
review differences before refreshing the snapshot. The existing drift check
continues to reject an unreviewed upgrade.
