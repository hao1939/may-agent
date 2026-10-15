<ai_context>
summary: "Pinned AgentHub Core inspection shows why a task control plane needs explicit recovery exits as well as a happy-path lifecycle: atomic claim, checkpoint-bound handoff, administrator cancellation, and integration-verified close cover different failure boundaries."
triggers: ["AgentHub Core", "task control plane", "atomic claim", "checkpoint handoff", "administrator recovery", "integration close", "Git worktree"]
last_updated: "2026-10-15"
source_basis: "Static inspection of HuangXin-erniu/agenthub-core revision 094c68b9bb0b9f3f936286492f6734051b69c908: README, SECURITY.md, CHANGELOG.md, agent_hub.py, and repository-authored tests. Scout did not run the software or tests."
</ai_context>

# Task control planes need recovery exits, not only a happy path

**Date:** 2026-10-15  
**Disposition:** New knowledge  
**Repo:** https://github.com/HuangXin-erniu/agenthub-core  
**Inspected revision:** https://github.com/HuangXin-erniu/agenthub-core/commit/094c68b9bb0b9f3f936286492f6734051b69c908

## Question

What does a small, implementation-backed agent task control plane reveal about the boundaries between assignment, execution custody, review, integration, and recovery?

## Observation

A current GitHub Repository Search for `"AI agent" checkpoint sandbox in:readme pushed:>2026-10-01`, sorted by recently updated, returned `incomplete_results: false` and surfaced `HuangXin-erniu/agenthub-core`. Before inspecting repository contents, Scout pinned the default branch to commit `094c68b9bb0b9f3f936286492f6734051b69c908` (release 2.3.3).

At that revision, AgentHub Core implements a decision-first lifecycle over SQLite and isolated Git worktrees. The valuable signal is not the lifecycle diagram alone, but the separate failure boundaries around it:

- **Claim and state must fail together.** `do_claim` creates or checks the worktree, changes the task to `in_progress`, records the claim, and reads the first task packet inside one `BEGIN IMMEDIATE` transaction. An exception rolls back task state. The 2.3.3 changelog says the earlier order could leave a task permanently claimed when the first Git read failed.
- **A handoff needs phase-current recovery evidence.** Ordinary device handoff requires a checkpoint whose event ID is newer than the latest claim or handoff and was written by the executor on the active device. Administrator recovery can proceed without that checkpoint, but records the missing checkpoint and a non-empty explanation instead of pretending continuity was proven.
- **Submission, approval, integration, and closure are different facts.** Completed submission checks the branch, exact HEAD commit, clean worktree, base ancestry, and changed paths. Review can then produce `approved`, but `close` separately verifies that the approved task commit is an ancestor of the target branch's current declared merge commit before removing the worktree and marking the task closed.
- **Recovery exits are part of the lifecycle contract.** Release 2.3.3 adds administrator-only cancellation for `in_progress` and `approved`, two states that previously had no exit when execution wedged or an approved merge would not happen. It also adds report-first worktree pruning that skips live or dirty worktrees and refuses directories Git does not identify as worktrees.

The repository-authored tests cover current-phase checkpoint requirements, forced handoff audit fields, transaction rollback when audit recording fails, administrator cancellation of a claimed task, integration-verified close, and source-and-target path checks for renames. These are authored regression claims, not independent reproduction.

## Interpretation

A durable task controller needs two designs at once: a narrow successful transition graph and an explicit escape graph. Atomicity prevents the controller from manufacturing a state that no executor can continue; fresh checkpoints make custody transfer evidence-bearing; administrator recovery preserves the fact that continuity evidence was absent; and a separate integration close prevents “review approved” from becoming “landed.”

The reusable design rule is to specify, for every non-terminal state: (1) the normal successor, (2) which failures can strand it, (3) who may recover or cancel it, (4) what evidence is required or recorded as missing, and (5) which cleanup is safe only after the state transition is settled. A one-way happy path is incomplete even when every ordinary transition is validated.

## Limits

Scout performed static inspection only. The repository was created five days before observation and GitHub metadata reported one star and no forks, so this is an early implementation pattern rather than adoption or production-reliability evidence. Scout did not clone the repository, execute its unit tests, exercise concurrent processes, simulate crashes, inspect a private deployment, or validate Windows/SSH behavior. The project's security document explicitly says caller-declared agent/device IDs are workflow identifiers rather than cryptographic authentication and that Git path checks do not sandbox execution or prevent filesystem reads. SQLite is documented as belonging to one authority host; the evidence does not establish distributed consensus, hostile multi-tenant isolation, or exactly-once external effects.

## Primary evidence

- [README and lifecycle](https://github.com/HuangXin-erniu/agenthub-core/blob/094c68b9bb0b9f3f936286492f6734051b69c908/README.md)
- [Security and trust boundary](https://github.com/HuangXin-erniu/agenthub-core/blob/094c68b9bb0b9f3f936286492f6734051b69c908/SECURITY.md)
- [2.3.3 recovery changes](https://github.com/HuangXin-erniu/agenthub-core/blob/094c68b9bb0b9f3f936286492f6734051b69c908/CHANGELOG.md)
- [Claim, handoff, submission, review, close, and cancellation implementation](https://github.com/HuangXin-erniu/agenthub-core/blob/094c68b9bb0b9f3f936286492f6734051b69c908/agent_hub.py)
- [Lifecycle tests](https://github.com/HuangXin-erniu/agenthub-core/blob/094c68b9bb0b9f3f936286492f6734051b69c908/tests/test_agenthub.py)
- [Handoff, transaction, and path-integrity tests](https://github.com/HuangXin-erniu/agenthub-core/blob/094c68b9bb0b9f3f936286492f6734051b69c908/tests/test_integrity.py)
