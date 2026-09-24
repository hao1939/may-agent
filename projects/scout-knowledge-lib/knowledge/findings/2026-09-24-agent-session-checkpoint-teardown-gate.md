---
title: "Mjolnir — Recovery Proof Must Gate Destructive Session Transitions"
source: github
source_id: "BrokkAi/mjolnir@b5709eb01736bd1320ee06ed01587154c6ba7cf6"
date: 2026-09-24
last_updated: 2026-09-24
type: finding
tags: [github, ai-agents, durable-sessions, checkpoints, recovery, lifecycle, concurrency]
relevance: high
---

<ai_context>
This note records a static source assessment of Mjolnir's durable-session checkpoint and teardown design. Its reusable contribution is to make recovery evidence, destructive lifecycle state, target identity, and concurrency ownership separate gates. Scout did not run the repository or reproduce its project-authored tests.
</ai_context>

# Mjolnir — Recovery Proof Must Gate Destructive Session Transitions

## Source and coverage

- **Repo:** [BrokkAi/mjolnir](https://github.com/BrokkAi/mjolnir)
- **Inspected revision:** [`b5709eb01736bd1320ee06ed01587154c6ba7cf6`](https://github.com/BrokkAi/mjolnir/commit/b5709eb01736bd1320ee06ed01587154c6ba7cf6)
- **Observation date:** 2026-09-24
- **Read:** repository metadata and complete tree; README; durability documentation; the checkpoint-transfer, lifecycle, recovery-gate, checkpoint-lease, and workspace-lease implementations; and the repository's checkpoint-transfer/destruction-recovery implementation plan.
- **Not run:** builds, checkpoint transfers, corruption cases, target cleanup, crash recovery, or repository-authored tests. The plan's reported test counts are author evidence, not independently reproduced results.
- **Disposition:** new knowledge — a concrete implementation of proof-gated teardown and race-safe recovery for durable agent sessions.

## Source observations

Mjolnir separates a logical agent session from the target currently running it. Its durability guide distinguishes the newest target-side journal from an older controller-held recovery archive: work beyond the archive frontier remains recoverable only while the original target storage exists. That distinction prevents “a checkpoint exists” from implying that all accepted work is safely portable.

The transfer implementation makes successful verification a capability rather than a boolean convention. `VerifiedCheckpoint` can be constructed only inside the transfer module after the downloaded archive's SHA-256 matches the target-reported digest and the archive is atomically installed. On a mismatch, the error includes expected and observed digests, byte count, session and operation identity, and retained archive path; the prior verified checkpoint and source workspace are left intact.

Destruction then rechecks more than possession of that artifact. Under a per-session target mutex, lifecycle code requires the session to be `Closing` or `Destroying`, requires its current checkpoint metadata to equal the supplied proof, persists `Destroying` before target cleanup, verifies the installed checkpoint again, and only then quiesces or removes the exact target. The target locator remains durable through deferred cleanup, making cleanup retryable after daemon restart.

The concurrency boundary matters because a background recovery admitted before close could restart the target while teardown is removing it. A shared per-session mutex orders recovery and destruction; once destruction has persisted, later recovery becomes ineligible. A separate recovery gate reserves or cancels automatic copies and worker replacements around foreground lifecycle operations. These mechanisms solve different races and are not interchangeable.

## Reusable design signal: teardown needs a typed recovery receipt

A durable agent runtime should treat destructive transition authority as a conjunction of independently checked facts:

1. **Capture frontier:** identify the exact journal prefix and event-frontier digest covered by the archive.
2. **Artifact integrity:** verify transferred bytes, archive structure, and payload hashes before installing a new recovery point.
3. **Proof freshness:** bind teardown to the session's current checkpoint metadata, not merely to any valid historical archive.
4. **Target identity:** re-read durable state and act only on the target locator still owned by that session.
5. **Lifecycle durability:** persist the non-recoverable destructive state before issuing cleanup commands.
6. **Concurrency ownership:** serialize already-admitted recovery with destruction, while suppressing recovery admitted after the destructive state is durable.
7. **Failure preservation:** retain the source and previous verified recovery point when export, transfer, verification, persistence, or cleanup fails.

The general lesson is stronger than “checkpoint before delete.” A checkpoint attempt is not a teardown permit. The permit is a fresh, identity-bound receipt for an exact frontier, combined with durable lifecycle state and exclusive ownership of the target transition.

## Limitations

This assessment is based on project-authored documentation and static inspection of one revision. It does not establish that every lifecycle path uses these gates, that the implementation is free of races, or that the claimed test results correspond to a published binary. The checked-in plan describes the motivating incidents and reported test outcomes but explicitly says the original live incidents were not reproduced or modified.

## Primary sources

- [Durability and recovery](https://github.com/BrokkAi/mjolnir/blob/b5709eb01736bd1320ee06ed01587154c6ba7cf6/docs/src/content/docs/durability.md)
- [Checkpoint transfer and `VerifiedCheckpoint`](https://github.com/BrokkAi/mjolnir/blob/b5709eb01736bd1320ee06ed01587154c6ba7cf6/mj-controller/src/checkpoint_transfer.rs)
- [Verified destruction lifecycle](https://github.com/BrokkAi/mjolnir/blob/b5709eb01736bd1320ee06ed01587154c6ba7cf6/mj-controller/src/controller/lifecycle.rs)
- [Recovery gate and per-session target mutex](https://github.com/BrokkAi/mjolnir/blob/b5709eb01736bd1320ee06ed01587154c6ba7cf6/mj-controller/src/recovery_gate.rs)
- [Checkpoint transfer and destruction-recovery plan](https://github.com/BrokkAi/mjolnir/blob/b5709eb01736bd1320ee06ed01587154c6ba7cf6/.agents/plans/checkpoint-transfer-and-destruction-recovery.md)
