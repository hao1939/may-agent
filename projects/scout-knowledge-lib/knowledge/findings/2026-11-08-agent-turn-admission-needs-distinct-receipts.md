<ai_context>
summary: "Pinned Paradev source separates prompt deduplication, same-user steering, cross-user queueing, workflow delivery, steer-complete settlement, and turn-scoped authority for agent sessions."
triggers: ["Paradev", "agent turn queue", "prompt deduplication", "steer settlement", "turn-scoped credentials", "Temporal agent workflow"]
last_updated: "2026-11-08"
source_basis: "Static inspection of ParadevAI/Paradev at commit 0da800deb69d922660c5351f987f5c085c74ea0f; Scout did not run Paradev, its tests, database, Temporal workflow, agents, hosts, or credential paths."
</ai_context>

# Agent turn admission needs distinct receipts

**Date:** 2026-11-08  
**Disposition:** new knowledge  
**Question:** When several prompts target one persistent agent session, what state prevents duplicate work, cross-user authority mixing, lost follow-ups, and premature settlement?  
**Repo:** https://github.com/ParadevAI/Paradev  
**Reviewed version:** commit [`0da800deb69d922660c5351f987f5c085c74ea0f`](https://github.com/ParadevAI/Paradev/commit/0da800deb69d922660c5351f987f5c085c74ea0f)  
**Coverage:** repository README, complete repository tree, agent-turn schema and migration, turn submission and queue implementation, worker credential and settlement implementation, turn-token implementation and tests, selected router tests, Temporal client wrapper, and agent-session handoff documentation. Scout performed static inspection only.

## Source observation

Paradev's current source models a prompt entering an agent session as one of four explicit outcomes: `started`, `joined`, `queued`, or `duplicate`. The database enforces at most one `running` turn per session and one primary prompt ID per session. A new prompt starts work when no turn runs. A prompt from the same acting user can join the running turn as a steer. A prompt that cannot join waits as a separate queued turn, preserving its own acting user, text, reason, and trigger metadata. A previously observed primary or steer prompt ID creates no new record.

Database admission is not treated as workflow delivery. After recording a started turn or steer, the API separately sends it to the Temporal-backed session workflow. If that delivery fails, the new turn is deleted or the steer ID is removed, allowing the same prompt ID to be submitted again. Conversely, resending a prompt whose turn is still running redelivers it because the workflow is expected to discard prompt IDs it has already consumed. The design therefore uses the stable prompt ID on both sides of the database/workflow boundary rather than interpreting either an insert or a network reply as proof of exactly-once execution.

Settlement has another fence. The worker reports how many steer prompts it consumed, and the database update settles a running turn only when that number equals the current steer-array cardinality. A newer steer arriving before settlement causes a conflict instead of letting the worker close over stale input. Once a turn settles, the oldest queued turn is promoted. If the workflow cannot start that promoted turn, its status is returned to `queued` for later reconciliation.

Authority is also tied to live turn state. A worker can obtain a signed 15-minute turn token or turn credentials only for an existing `running` turn whose agent is not archived. The claims bind turn, session, agent, organization, and acting user. The returned host, model route, session-log ticket, reply room, and MCP URL are derived from that same live record. Retry telemetry, terminal result, queued successor, and the final session-log marker remain separate operations.

## Interpretation

A persistent agent session benefits from at least six separate receipts:

1. **prompt identity** — a stable ID says whether this exact trigger was already admitted;
2. **admission outcome** — the trigger started, joined, queued, or duplicated rather than merely “reached the agent”;
3. **delivery state** — the workflow actually received the admitted start or steer, or the admission was rolled back for retry;
4. **acting identity** — steering is allowed only within the running turn's acting-user boundary; otherwise work queues separately;
5. **input-completeness fence** — settlement proves the worker consumed every steer known at the database boundary;
6. **live authority** — credentials are minted from a still-running turn and bind the actor and execution identities.

The useful pattern is not a claim of exactly-once execution. It is an explicit protocol for surviving an uncertain handoff between durable admission and an external workflow. Deduplication, delivery, consumption, settlement, and authority are related but non-equivalent facts. In particular, a durable row can exist without successful workflow delivery, and a worker that finished its original prompt may still owe a newly joined steer.

For May-like task runtimes, the closest application is to keep input admission, worker wake, attempt consumption, result settlement, and delegated authority as distinct receipts. A task row or event insertion should not itself prove that the correct worker observed the input; likewise, a worker's attempted final result should fail closed when newer accepted input became part of the same execution boundary before settlement.

## Comparison with existing Scout knowledge

[Lightweight waiting agents need durable facts, not resident workers](./2026-11-07-agent-recovery-admission-effect-boundary.md) separates durable admission from uncertain effects and replay. Paradev is a distinct implementation subject that adds a concurrent-input protocol inside one persistent session: same-actor prompts may steer the active turn, unlike-actor prompts queue, and settlement is conditional on the worker's consumed-steer count. [Background agent recovery needs a prepared-attempt fence](./2026-11-08-background-agent-launch-recovery-boundary.md) focuses on reconnecting a long-running process after launch uncertainty; this finding instead focuses on admission and settlement when new prompts race with an already-running logical turn.

## Limitations

The evidence is repository-authored and was not independently executed. Scout did not build or run Paradev, its database migrations or constraints, the Temporal workflow, retries, concurrent submissions, queue promotion, credential issuance, agents, hosts, model routes, MCP tools, or session-log writes. Project-authored tests were inspected selectively but not run. Static code shows intended transaction and conflict boundaries, not production reliability, isolation, fairness, or complete authorization coverage.

The implementation also leaves important questions outside the inspected evidence. The queue is ordered by `startedAt`, but Scout did not test timestamp ties or starvation. The API retries admission only three times around races. A promoted turn whose workflow start fails is requeued, but this inspection did not establish the reconciler's eventual-start guarantee. Fifteen-minute signed tokens narrow issuance to a running turn, yet token revocation after early settlement, downstream verification on every effect route, and leakage resistance were not established. The design should therefore be read as a concrete receipt pattern, not proof of exactly-once execution or complete mediation.
