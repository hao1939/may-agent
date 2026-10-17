<ai_context>
This finding examines Minerva's pinned recovery and authorization design as evidence that an agent runtime must treat uncertain external writes differently from replayable reads and rollback-capable local file changes, and must keep temporal revocation separate from a static permission decision. Scout inspected first-party documentation, policy and executor source, and project-authored tests but did not deploy the hosted product, run its tests, inspect every connector, reproduce a crash, or exercise revocation against a live provider.
</ai_context>

# Agent recovery must preserve uncertainty across unlike effects

**Date:** 2026-10-16  
**Last checked:** 2026-10-17  
**Repo:** <https://github.com/minervacomputing/harness>  
**Pinned revisions inspected:** [`46738514da2c7cd5322a95722b8b0aa4c2181431`](https://github.com/minervacomputing/harness/tree/46738514da2c7cd5322a95722b8b0aa4c2181431) (recovery), [`45bad482bc6709f8cce4a6640cadc286b459f344`](https://github.com/minervacomputing/harness/tree/45bad482bc6709f8cce4a6640cadc286b459f344) (authorization and revocation update)  
**Disposition:** Updated knowledge

## Question

How should an agent runtime recover after its worker dies when model progress, local files, reads, and external writes have different replay and rollback properties? As a follow-up, how should that runtime keep a valid resource-level permission decision from outliving the run or attempt that made it?

## Finding

Minerva's pinned design does not promise generic “resume.” It gives each effect class a different recovery rule: committed agent-loop progress resumes; an interrupted read may run again; the conversation folder returns to its last checkpoint; and an external write left in flight is marked **uncertain**, is not automatically retried, and blocks later writes in that run. Identical writes with a recorded success return the first outcome instead of dispatching again.

The reusable principle is: **recovery correctness is an effect-typed decision, not restoration of one global state.** A system that rolls local files back and replays the whole tool trace can duplicate an irreversible provider action. A system that assumes every dispatched action succeeded can silently omit work. When the provider outcome cannot be established, preserving uncertainty and stopping dependent effects is more honest than manufacturing exactly-once semantics.

## What the pinned source shows

### 1. The write ledger is claimed before dispatch

`cloudflare/src/gateway/ledger.ts` derives a key from the tool name and normalized arguments, inserts a `dispatched` row before the provider request, permits only one dispatched write per run, and fixes the request deadline at dispatch. A later identical call can use the ledger's cached result. A provider refusal or a request known not to have been applied removes the row so the action may be tried again; an applied action retains its result.

This is narrower than universal idempotency. Deduplication is scoped to one run and to Minerva's canonicalized operation identity. It cannot make an upstream provider atomic, identify a semantically equivalent request with different normalized arguments, or resolve a provider that applied an action but lost the response.

### 2. A dead dispatcher turns in-flight writes into durable uncertainty

The ledger has three statuses: `dispatched`, `succeeded`, and `uncertain`. Its restart path changes every still-dispatched write for the run to `uncertain`, because the instance that sent it can no longer settle it reliably. A timeout sweep does the same after a grace period. An uncertain row is never silently cleared; it refuses both a duplicate of that write and every later write in the run, with guidance to check the provider.

This is an important dependency boundary. The risk is not only duplicating the interrupted action. Continuing with later mutations can compound an unknown state—for example, sending a notification whose truth depends on whether a refund happened. The runtime therefore propagates uncertainty into admission of subsequent effects rather than treating it as a warning attached to one old call.

### 3. Local progress and external effects recover asymmetrically

The architecture says the agent loop resumes from its last committed progress, while the folder returns to its last saved checkpoint. Reads interrupted by worker death can be replayed. External writes cannot be handled the same way: one left dispatched is recorded as uncertain, and retrying the same normalized action returns that verdict rather than sending it again.

Checkpointing itself is fenced. The documented sequence closes admission, waits for active calls, kills the agent cgroup, verifies it is empty, scans and hashes changed files, records the checkpoint, and only then releases held tool results to the agent loop. If the checkpoint fails, those results are not committed and the next attempt starts from the preceding checkpoint. This coordinates local filesystem visibility with model-visible completion, but it does not pretend to roll back an already-sent provider request.

### 4. Attempt fencing prevents old work from mutating the new attempt

The architecture requires asynchronous operations to carry run and attempt identity. Late calls, resets, sandbox operations, checkpoints, and event appends from an old attempt are refused when their fence is no longer current; settling an already-dispatched external write is the documented exception, because learning its outcome is still useful. This separates stale authority from late evidence.

That distinction generalizes: a superseded worker should lose authority to initiate or overwrite state, while a delayed, trustworthy observation about an effect it already initiated may still close uncertainty.

## Update 2026-10-17: authorization has both spatial and temporal dimensions

A newer pinned revision makes a complementary boundary inspectable in code. `cloudflare/src/gateway/policy.ts` represents authority as the intersection of ceiling, user, and agent layers. Lower layers can only narrow higher ones, any matching deny wins, action prerequisites are checked on the same resource, and malformed persisted snapshots fail closed rather than becoming unrestricted. For hierarchical resources, incomplete ancestry is also treated conservatively: an unknown ancestor never supplies an allow and may carry an existing exact deny.

The executor does not stop at exposing only tools for which some permitted resource may exist. After a connector's `prepare()` resolves symbolic input into concrete resource requirements, `#authorize()` checks those requirements against the declared operation needs and the pinned policy. A mutating operation must name a concrete destination. This separates coarse tool visibility from effect admission: showing “read folder” does not authorize every folder, and a connector cannot silently add a resource/action pair it did not declare.

But that policy decision is only the spatial half of authority. The call can span credential leasing, preparation, and multiple provider requests, during which its run or attempt may be revoked or replaced. The executor therefore checks attempt currency before and after credential leasing, checks again after policy authorization, and gives the provider client an `admits` predicate tied to the current run. The project-authored revocation tests model two-request and prepare-then-execute operations: after revocation during the first request or lookup, the expected second request is absent; revocation immediately after a credential lease results in no provider request; replacing an attempt after a lookup suppresses even a result that would require no further request.

The reusable addition is: **least privilege must be evaluated as `(resource, action, time, attempt)`, not only `(resource, action)`.** A correct preflight decision can become stale before the next side effect. For a multi-request tool call, “authorized once” is weaker than complete mediation unless each request remains gated by live run authority. Conversely, revocation cannot unsend a request already in flight, so the write ledger's uncertainty and settlement rules remain necessary; temporal admission and effect recovery solve different parts of the race.

This update also sharpens two limitations. First, the policy is a run snapshot: the inspected path relies on revoking the run to stop stale authority rather than dynamically rebuilding its resource grants inside the executor. Second, the tests are project-authored simulations with injected provider behavior. Scout read them but did not run them or verify the same timing properties against Cloudflare, Laravel, or a live connector.

## Reusable implications

1. **Classify effects before choosing replay.** Reads, local reversible writes, idempotent provider operations, and non-idempotent external mutations need distinct rules.
2. **Persist intent before effect dispatch.** A durable claim lets recovery distinguish “never sent” from “may have happened.”
3. **Make uncertainty an admission state.** Unknown outcomes should block dependent mutations, not merely appear in logs.
4. **Fence authority by attempt.** Superseded workers must not checkpoint, reset, or initiate effects for the replacement attempt.
5. **Allow late settlement without restoring old authority.** A late response can provide evidence about a prior dispatch even when that attempt may do nothing else.
6. **Bind model-visible completion to durable local state.** Do not tell the agent a local mutation succeeded until the checkpoint that will survive recovery is committed.

## Limitations

- Scout inspected the README, `ARCHITECTURE.md`, and `cloudflare/src/gateway/ledger.ts` at the recovery revision, then the README, policy, grant construction, executor, and project-authored policy/revocation tests at the update revision. It did not run Minerva, its tests, a connector, a crash-recovery scenario, or a live revocation race.
- The architecture reports project-authored fault tests and deployed-platform measurements; these were not independently reproduced, and the hosted product is not self-hostable from this repository.
- Only the write-ledger implementation was inspected directly. Checkpoint, restart-gate, connector, and attempt-fencing behavior is described here from first-party architecture documentation rather than a complete code-path audit.
- Minerva's own trust model places the agent loop and dependencies in the Worker trust base, which can address workspace objects and credentials. The recovery protocol does not prove isolation from a compromised trusted runtime.
- The GitHub Search API returned `incomplete_results: false`, but the discovery query is a relevance filter, not an exhaustive survey of agent runtimes. Stars and update times were used only for discovery.

## Sources inspected

- Discovery query: GitHub Repository Search API, `"AI agent" sandbox pushed:>=2026-10-01 stars:>20`, sorted by updated; `total_count: 85`, `incomplete_results: false`
- [Pinned repository](https://github.com/minervacomputing/harness/tree/46738514da2c7cd5322a95722b8b0aa4c2181431)
- [README](https://github.com/minervacomputing/harness/blob/46738514da2c7cd5322a95722b8b0aa4c2181431/README.md)
- [Architecture](https://github.com/minervacomputing/harness/blob/46738514da2c7cd5322a95722b8b0aa4c2181431/ARCHITECTURE.md)
- [Write ledger implementation](https://github.com/minervacomputing/harness/blob/46738514da2c7cd5322a95722b8b0aa4c2181431/cloudflare/src/gateway/ledger.ts)
- [Engine/product separation plan](https://github.com/minervacomputing/harness/blob/46738514da2c7cd5322a95722b8b0aa4c2181431/docs/plans/product-and-engine.md)
- Update discovery query: GitHub Repository Search API, `"AI agent" (approval OR sandbox OR durable) pushed:>=2026-10-10 stars:>20`, sorted by updated; `total_count: 2053`, `incomplete_results: false`
- [Update revision](https://github.com/minervacomputing/harness/tree/45bad482bc6709f8cce4a6640cadc286b459f344)
- [Policy evaluator](https://github.com/minervacomputing/harness/blob/45bad482bc6709f8cce4a6640cadc286b459f344/cloudflare/src/gateway/policy.ts)
- [Grant-to-policy construction](https://github.com/minervacomputing/harness/blob/45bad482bc6709f8cce4a6640cadc286b459f344/cloudflare/src/gateway/grants.ts)
- [Executor](https://github.com/minervacomputing/harness/blob/45bad482bc6709f8cce4a6640cadc286b459f344/cloudflare/src/gateway/executor.ts)
- [Policy tests](https://github.com/minervacomputing/harness/blob/45bad482bc6709f8cce4a6640cadc286b459f344/cloudflare/test/unit/policy.test.ts)
- [Revocation tests](https://github.com/minervacomputing/harness/blob/45bad482bc6709f8cce4a6640cadc286b459f344/cloudflare/test/unit/executor-revocation.test.ts)

## Related Scout knowledge

- [Durable execution still has separate step, effect, and consumer checkpoints](./2026-10-02-agent-sdk-go-durability-boundaries.md) distinguishes completed-step journaling, in-flight retry, reconnect, and downstream processing.
- [ALGAL makes waiting and recovery part of the agent program contract](./2026-10-01-algal-durable-agent-programs.md) covers exact-prefix replay, uncertain dispatch, idempotency, and host responsibilities.
- [Agent recovery should restore state without rewriting lineage](./2026-10-15-pong-handoff-recovery-lineage.md) separates checkpoint, resume, rollback, and ancestry.
