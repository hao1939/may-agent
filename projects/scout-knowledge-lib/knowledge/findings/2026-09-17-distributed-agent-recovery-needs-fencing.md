<ai_context>
summary: "Agentic SDLC's current shell harness and its explicit distributed-mode proposal expose why durable task state alone does not make agent recovery safe. Correct takeover needs separate task-generation, attempt, action, leader-epoch, and candidate identities, plus fencing enforced by runners and the publication boundary; an unreachable worker remains uncertain rather than retryable by default."
triggers: ["agentic-sdlc", "distributed agents", "crash recovery", "attempt identity", "leader epoch", "publication fencing", "uncertain worker", "idempotent launch", "candidate identity"]
last_updated: "2026-09-17"
source_basis: "GitHub repository Igosuki/agentic-sdlc at pinned revision 68c499687b32866ac55c3bda483ffac484aa3871; inspected the complete untruncated 122-entry tree, current finish/resume/merge-queue scripts, workflow documentation, the distributed-mode proposal, README, and selected tests. Tests were inspected but not executed."
</ai_context>

# Distributed agent recovery needs identities and fencing, not just durable tasks

**Date:** 2026-09-17  
**Source:** GitHub repository inspection  
**Repo:** https://github.com/Igosuki/agentic-sdlc  
**Inspected revision:** [`68c499687b32866ac55c3bda483ffac484aa3871`](https://github.com/Igosuki/agentic-sdlc/commit/68c499687b32866ac55c3bda483ffac484aa3871)

## Observation

Agentic SDLC is a young Claude Code plugin that represents work in Beads, gives workers isolated git worktrees, reviews their diffs, rebases and verifies them under a per-target merge queue, and records worker sessions for recovery. Its current local harness has several useful controls: review occurs outside the merge queue; verification is rerun after rebase; publication to a local target is serialized; and a task may be resumed only when its state, worktree, transcript, and absence of a detected live worker agree.

The repository is unusually explicit that these local mechanisms do **not** establish safe distributed recovery. Its [`distributed-mode.md`](https://github.com/Igosuki/agentic-sdlc/blob/68c499687b32866ac55c3bda483ffac484aa3871/docs/hypotheses/distributed-mode.md) is marked as a proposal with no runtime changes implemented, and inventories concrete seams in the current scripts:

- [`merge-queue.sh`](https://github.com/Igosuki/agentic-sdlc/blob/68c499687b32866ac55c3bda483ffac484aa3871/scripts/merge-queue.sh) discovers a queue key, creates a lock bead, then writes the key as separate operations. Concurrent initialization can create two lock identities for one branch. A task ID is also the holder identity, so two executions of the same task can both appear to own the queue.
- [`resume-task.sh`](https://github.com/Igosuki/agentic-sdlc/blob/68c499687b32866ac55c3bda483ffac484aa3871/scripts/resume-task.sh) checks for a worker and then starts a resumed process. That inspect-then-launch sequence is not an atomic admission protocol across competing recovery controllers.
- [`finish-task.sh`](https://github.com/Igosuki/agentic-sdlc/blob/68c499687b32866ac55c3bda483ffac484aa3871/scripts/finish-task.sh) advances Git before closing the Beads task. A crash in between creates a delivered-but-open state that cannot safely be interpreted by simply rerunning or reimplementing the task.
- Review approval is cached by stable patch ID before rebase. The proposal correctly notes that an unchanged patch ID alone does not bind review and checks to the exact target state or conflict resolution that will be published.

The proposed correction separates four authorities: desired task state, runtime attempts/actions, runner process state, and Git publication. It then gives their operations independent durable identities: `task_generation`, `attempt_id`, `action_id`, `leader_epoch`, and a `candidate_id` binding repository, target ref, expected base, source revisions, and verification configuration.

That decomposition matters because retries answer different questions. Reusing an `action_id` asks a runner whether the same launch was accepted; a new `attempt_id` denotes new execution; a higher `leader_epoch` fences stale controllers; and a `candidate_id` proves which exact artifact was checked and authorized for publication. One generic task ID cannot safely stand in for all four.

The proposal's strongest operational rule is about uncertainty: a missing heartbeat means **unreachable**, not dead. A replacement attempt should not be launched until termination or execution fencing is confirmed. Publication fencing can prevent a stale worker from landing code, but cannot stop it consuming model tokens or mutating other external systems. Progress may therefore pause for one task while unrelated work continues. This is a deliberate correctness trade-off, not a liveness bug to hide with a timeout.

These are repository-authored requirements and source-visible implementation gaps, not proof of a production incident or of the proposed design working. The distributed document is explicitly pre-implementation.

## Reusable implication

Crash recovery for long-running agents should model at least three distinct outcomes:

1. **desired work** — whether the task should still happen;
2. **execution reality** — whether a specific attempt/action exists or may still be live; and
3. **delivered effect** — whether an exact verified candidate reached the protected target.

A safe takeover protocol then needs:

- atomic admission and capacity reservation tied to task generation;
- idempotent runner commands queryable by stable action and attempt identity;
- monotonic ownership epochs enforced at the runner and publication boundaries, not merely checked before a call;
- durable publication intent plus reconciliation against the actual target ref before retrying;
- evidence bound to the exact candidate and expected target state; and
- an explicit `uncertain` state that blocks conflicting replacement while preserving independent progress.

The general lesson is: **durability answers what was recorded; fencing answers who is still allowed to act. Distributed agent recovery needs both.**

## Evidence limits

- GitHub repository Search returned `incomplete_results=false`; this candidate came from a 20-item page of 3,001 matches for the recorded query.
- The pinned recursive tree returned `truncated=false` with 122 entries.
- Scout inspected source, documentation, and selected tests but did not execute the test suite, launch Claude workers, manipulate Beads, or perform Git/GitHub mutations.
- The high-availability architecture is a proposal dated 2026-09-16 and explicitly says it is not implemented. Its contracts should not be described as delivered capabilities.

## Sources

- Repository: https://github.com/Igosuki/agentic-sdlc
- Pinned revision: https://github.com/Igosuki/agentic-sdlc/commit/68c499687b32866ac55c3bda483ffac484aa3871
- README: https://github.com/Igosuki/agentic-sdlc/blob/68c499687b32866ac55c3bda483ffac484aa3871/README.md
- Current workflow and recovery contract: https://github.com/Igosuki/agentic-sdlc/blob/68c499687b32866ac55c3bda483ffac484aa3871/docs/workflow.md
- Distributed-mode proposal and gap inventory: https://github.com/Igosuki/agentic-sdlc/blob/68c499687b32866ac55c3bda483ffac484aa3871/docs/hypotheses/distributed-mode.md
- Merge queue implementation: https://github.com/Igosuki/agentic-sdlc/blob/68c499687b32866ac55c3bda483ffac484aa3871/scripts/merge-queue.sh
- Resume path: https://github.com/Igosuki/agentic-sdlc/blob/68c499687b32866ac55c3bda483ffac484aa3871/scripts/resume-task.sh
- Review, verification, and merge path: https://github.com/Igosuki/agentic-sdlc/blob/68c499687b32866ac55c3bda483ffac484aa3871/scripts/finish-task.sh
- Complete pinned tree: https://api.github.com/repos/Igosuki/agentic-sdlc/git/trees/68c499687b32866ac55c3bda483ffac484aa3871?recursive=1
