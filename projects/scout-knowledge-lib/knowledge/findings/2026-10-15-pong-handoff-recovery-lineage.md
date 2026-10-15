<ai_context>
summary: "Pinned static inspection of Pong shows why agent handoff, checkpoint, resume, rollback, and version ancestry should remain separate durable relations: recovery restores state without rewriting task identity or fabricating lineage."
triggers: ["agent handoff", "checkpoint resume", "rollback lineage", "durable execution", "Pong", "recovery provenance"]
last_updated: "2026-10-15"
source_basis: "GitHub repository search and static inspection of NJHTR/pong revision 6c01f364529329df8badcbba12414754ce4fb613; Scout did not compile or execute the project or its tests."
</ai_context>

# Agent recovery should restore state without rewriting lineage

**Date:** 2026-10-15  
**Disposition:** new knowledge  
**Question:** What durable identities should an agent runtime preserve when work is handed off, resumed, or rolled back?

Pong is an early local-first execution and versioning system for agent work. Its most useful signal is not the broad “version control for agents” framing, but a precise separation of **task identity, execution ownership, recoverable state, and version ancestry**. A handoff is a durable relation between two executions of the same task; a checkpoint is an immutable reference to a version; resume creates a new execution; and rollback records a recovery action without deleting prior versions or pretending the restored version is the new execution's parent.

That separation prevents three common provenance errors:

1. **handoff as completion:** transferring ownership must not rewrite the source attempt as successfully completed;
2. **resume as continuation without identity:** a recovery attempt needs a new execution identity and an explicit reference to the source version or checkpoint;
3. **rollback as ancestry:** restoring older state must not fabricate a version-graph edge or erase the failed path that motivated recovery.

The pinned implementation provides more than design prose. `src/metadata.rs` stores handoffs, checkpoints, rollback records, and resume attempts in distinct tables. Creation paths bind a caller-supplied request ID to a request digest: an exact retry returns the existing durable relation, while changed content under the same key returns an idempotency conflict. Handoff creation verifies that source and target executions belong to the task, differ from one another, and are in compatible source/fresh-target states. Checkpoint and resume tests cover pre-commit rollback, post-commit recovery, cold reopen, missing-parent fail-closed behavior, and stale lease/revision rejection.

The architecture's old-or-new boundary is the transferable pattern. After an uncertain commit, reopening should reveal either the complete prior state or a complete new relation with matching state changes—never an active target without a handoff record, a dangling checkpoint, or a rollback whose materialized state and heads disagree. Scope remains explicit: an execution-local checkpoint does not grant task-wide rollback authority, and rolling back one workspace does not imply coordinated rollback of parallel agents.

## Implication for agent control planes

Represent recovery operations as first-class, independently queryable facts rather than overloaded status edits:

- keep the task stable while giving every attempt or resumed run its own execution identity;
- record handoff source, target, checkpoint, actor, request identity, and bounded context;
- distinguish a checkpoint's immutable state reference from the authority to restore it;
- retain both pre-recovery history and the recovery operation;
- bind idempotent retries to canonical request content, not only a free-form key;
- after uncertain writes, recover by inspecting durable state rather than blindly repeating the action.

This complements Scout's [acceptance and reconciliation note](../agent-runtime-acceptance-and-reconciliation.md): accepting a result and transferring execution ownership are separate authority-bearing events, even when they concern the same task.

## Evidence and limits

GitHub Repository Search returned `incomplete_results: false` for the topic-led query. The selected repository had eight stars and no declared license in GitHub metadata at inspection. Scout inspected the pinned README, handoff/checkpoint/rollback contract, metadata implementation, and project-authored tests. Scout did **not** compile or run Pong, replay its crash failpoints, independently verify the claimed passing test counts, or assess distributed operation. The README explicitly says the project is not production-ready and lacks supported provider integration, remote replication, a scheduler, and several policy layers. The evidence therefore supports a concrete static data-model and recovery-contract pattern, not reliability, security, or production-readiness claims.

- **Repo:** https://github.com/NJHTR/pong
- **Inspected revision:** [`6c01f364529329df8badcbba12414754ce4fb613`](https://github.com/NJHTR/pong/commit/6c01f364529329df8badcbba12414754ce4fb613)
- **Primary sources:** [README and explicit limits](https://github.com/NJHTR/pong/blob/6c01f364529329df8badcbba12414754ce4fb613/README.md), [handoff/checkpoint/rollback contract](https://github.com/NJHTR/pong/blob/6c01f364529329df8badcbba12414754ce4fb613/docs/architecture/M3_HANDOFF_CHECKPOINT_ROLLBACK.md), [durable metadata implementation](https://github.com/NJHTR/pong/blob/6c01f364529329df8badcbba12414754ce4fb613/src/metadata.rs), and [project-authored recovery tests](https://github.com/NJHTR/pong/blob/6c01f364529329df8badcbba12414754ce4fb613/tests/handoff_checkpoint_rollback.rs)
- **Discovery query:** GitHub Repository Search API `"AI agent" checkpoint resume pushed:>2026-09-15`, sorted by update time; `incomplete_results: false`
