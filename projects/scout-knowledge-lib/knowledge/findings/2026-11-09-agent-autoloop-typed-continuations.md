<ai_context>
summary: "Pinned Agent Autoloop review: unattended agent work needs typed continuation channels for human decisions, deferred rechecks, retries, and emitted events, with durable lineage rather than one ambiguous running state."
triggers: ["Agent Autoloop", "background agent continuation", "human approval card", "deferred agent recheck", "agent event hop limit", "durable agent wait"]
last_updated: "2026-11-09"
source_basis: "Static inspection of KKKKhazix/agent-autoloop documentation, security boundary, kernel store, worker receipt parser, and project-authored tests at commit 6e34d38624b84e47b2ca7f54c0c536cfaf1c3fcb; Scout did not run the software, tests, simulations, agents, plugins, installers, delivery path, or benchmarks."
</ai_context>

# Background agent loops need typed continuation channels

**Date:** 2026-11-09  
**Disposition:** new knowledge  
**Question:** How should an unattended local agent runtime represent work that pauses, retries, asks a human, or wakes later without treating all of it as one continuously running turn?  
**Repo:** https://github.com/KKKKhazix/agent-autoloop  
**Reviewed version:** commit [`6e34d38624b84e47b2ca7f54c0c536cfaf1c3fcb`](https://github.com/KKKKhazix/agent-autoloop/commit/6e34d38624b84e47b2ca7f54c0c536cfaf1c3fcb)  
**Coverage:** repository README and tree; `SECURITY.md`; `docs/protocol.md`; `kernel/store.ts`; `worker/contract.ts`; and selected project-authored tests for hop depth, session continuation, and source-visible outcomes. Scout did not execute any code.

## Source observation

Agent Autoloop is a local event-to-CLI-agent scheduler. Its most useful signal is not simply that an agent can run in the background. The inspected protocol makes several different continuation states explicit:

- A turn can finish with an `ask` receipt. The process exits; the open question persists, and a human answer creates a later turn linked back to the session that asked it.
- A turn can finish with a `later` receipt. The named recheck persists until its due time, can be rescheduled or cancelled by key, and wakes work with the original chain depth.
- A transient execution failure uses a failed outcome and is eligible for bounded retry. A human-only login or connection block is instead represented as a finished turn plus an open question, so the runtime does not confuse waiting for a person with a failed process.
- A turn can emit new events only within the rule-authorized source and type surface. Emitted events inherit maximum input depth plus one; answers and deferred timers retain the original depth. The checked-in hop test records events beyond depth eight but does not dispatch them.
- Source-visible event outcomes distinguish queued, claimed, retrying, unknown, done, cancelled, and stopped states. A missing worker heartbeat becomes `unknown`, and a later result can still be accepted rather than being silently equated with failure.

The durability mechanism is an append-only fact log plus a rebuildable projection committed in one SQLite transaction. `kernel/store.ts` checks that the log has not advanced before appending facts and updates the projection in the same transaction. The documentation says timers, retries, leases, and offline detection share a durable due table rather than one resident model process per wait.

The worker contract also narrows what the model can request from the scheduler. The final message may contain only `ask`, `notice`, `resolve`, `later`, and `events`; malformed receipts get a formatting repair turn without redoing completed business work. Event bodies remain in a context file marked as data, while routing, working directory, skill, and access come from trusted rules.

## Interpretation

An unattended agent loop needs **typed continuation channels**, not a generic `running` flag and not a promise that the model will remember what to do next.

At minimum, preserve these as different durable relations:

1. **retry** — the same attempt class failed before a trusted result;
2. **human decision** — execution intentionally ended with a specific unresolved choice;
3. **deferred observation** — no person is needed, but a named fact must be checked later;
4. **derived event** — completed work intentionally creates another schedulable input;
5. **uncertain execution** — liveness was lost, but success or failure is not yet known.

Each relation needs its own identity, wake condition, lineage, and settlement rule. Otherwise common failures collapse together: duplicate approval prompts, polling while a human is already responsible, replaying completed work after a receipt-format error, opening one session concurrently, or creating an unbounded event loop.

The source also shows why a session identifier is an optimization rather than the durable work identity. The runtime can try to resume the conversation that asked a question, but its protocol opens a new session when the prior one may still have an active writer or cannot be resumed safely. Durable event, run, card, timer, and receipt facts remain the control record.

## Comparison with existing Scout knowledge

[Lightweight waiting agents need durable facts, not resident workers](./2026-11-07-agent-recovery-admission-effect-boundary.md) establishes the broader scheduling principle and the separate danger of uncertain external effects. Agent Autoloop is a distinct implementation subject: it adds a concrete continuation vocabulary for human questions, timers, retries, derived events, unknown liveness, session reuse, and event-chain depth.

This finding does **not** show that arbitrary tool effects become safe to replay. The project security document itself says interrupted or result-unknown browser effects should be reconciled rather than blindly repeated, and webhook delivery can duplicate when sending succeeds but its acknowledgement is lost.

## Limitations

This was static source inspection. Scout did not install Agent Autoloop, run its tests or simulations, inspect every decision path, connect Claude Code or Codex, test process crashes, verify SQLite durability under power loss, exercise human-card delivery, or reproduce benchmark and crash-test claims.

The security boundary is intentionally limited. `askFirst` is prompt guidance and is not enforced if the agent ignores it. ACP access controls depend on the agent following that protocol, generic command adapters do not impose equivalent restrictions, and same-user local processes are not isolated. Plugins are trusted local code. Card links are bearer capabilities. The repository says its simulations and SIGKILL checks cover bounded process-crash scenarios, not a complete security audit or proof of power-loss recovery.

Repository metadata, stars, documentation, and checked-in tests are not proof that the implementation works in a live installation. The public Search API response used for discovery reported `incomplete_results: false`, but that only describes this bounded query response, not exhaustive GitHub coverage.
