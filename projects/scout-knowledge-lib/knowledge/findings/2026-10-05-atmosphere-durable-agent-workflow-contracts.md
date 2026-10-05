---
title: "Atmosphere — Durable Resume Is a Versioned Contract, Not Exactly-Once Execution"
source: github
date: 2026-10-05
last_updated: 2026-10-05
type: finding
tags: [github, agent-runtime, durable-workflows, checkpointing, human-approval, idempotency]
relevance: high
---

<ai_context>
This source assessment separates Atmosphere's code- and test-observed resume behavior from stronger exactly-once or production-maturity claims. Use it when designing restart-safe agent workflows, approval expiry, or workflow upgrades. The repository was inspected statically at one pinned revision; Scout did not run its Java tests or deploy its persistence backends.
</ai_context>

# Atmosphere — Durable Resume Is a Versioned Contract, Not Exactly-Once Execution

## Assessment

**Question:** What concrete durability contracts does a current portable agent runtime implement, and where does application responsibility remain?

**Disposition:** New knowledge. No prior Scout note declared this repository as a primary source. The closest related note, [Orchigram — Durable Runs Need Semantic Closure, Not Just Plan Hashes](2026-08-08-durable-workflow-semantic-closure.md), examines a different runtime and the broader upgrade problem.

**Repo:** https://github.com/Atmosphere/atmosphere  
**Revision reviewed:** [`c01c50ccd426328979f6ae6f77e79aa4c1875b77`](https://github.com/Atmosphere/atmosphere/commit/c01c50ccd426328979f6ae6f77e79aa4c1875b77)  
**Observation date:** 2026-10-05  
**Coverage:** Repository metadata and recursive tree; root and checkpoint READMEs; `Workflow`, `WorkflowStep`, `WorkflowSnapshot`, and `DurableApprovalExpiry`; plus the SQLite cold-resume and approval-expiry tests. This was a partial source review, not a full-repository audit.

## Source-observed behavior

Atmosphere is a Java agent service layer with adapters for multiple AI frameworks. Its checkpoint module makes several useful boundaries unusually explicit:

1. **Hibernation returns instead of parking a worker.** A workflow step can return `Hibernate(state)`. The runner persists a snapshot and returns a hibernated result; a later invocation using the same coordination ID and checkpoint store continues after the recorded step. A checked test closes a SQLite store, opens a fresh handle over the same file, constructs a new workflow, and asserts that only the remaining `publish` step runs.

2. **Stable step names are persistent schema.** The last completed step name is written into snapshot metadata and used to find the next list position. The constructor rejects duplicate names, but the implementation warns that renaming or reordering steps while a run is dormant can resume at the wrong place. The workflow definition therefore needs compatibility treatment even when its application state schema has not changed.

3. **A checkpoint does not make external effects exactly once.** The implementation resumes after the last successfully persisted step. It still requires every step to be idempotent because transient retries re-run a step and a process can fail after an external effect lands but before the corresponding snapshot is saved. Atmosphere's own source comments put the double-effect guard inside the application step.

4. **Approval expiry is represented as a durable state transition, not replayed consent.** `DurableApprovalExpiry` arms a persisted timer when an approval effect is pending. If it fires without a committed decision, the effect is marked `FAILED`, so resume re-prompts rather than trusting a lapsed gate. Before failing it, the callback checks for a committed decision; the effect journal also refuses to demote a committed effect. Deterministic tests cover pending-to-failed expiry, cancellation, a decision winning the timer race, and a timer firing after a service restart.

5. **Snapshot history and client-session recovery are different scopes.** `WorkflowSnapshot` forms a parent chain for a coordination, while the checkpoint README distinguishes this tool-boundary history from connection-oriented durable sessions. A reconnect token may point to a checkpoint, but retaining a client session is not itself proof that workflow effects are settled.

## Reusable interpretation

A durable agent workflow should publish three contracts independently:

- **Resume address:** stable run identity, stable step identity, persisted state, and the exact rule for selecting the next step.
- **Effect settlement:** an idempotency key or effect journal around every side effect that can land before its local completion record.
- **Gate freshness:** approval, expiry, cancellation, and supersession as explicit competing states; timeout means the absence of a current decision, never permission to replay old consent.

Atmosphere also reinforces the semantic-upgrade concern in the related Orchigram note: step names are behavior-bearing persisted data. A production runtime should version the workflow definition, reject or migrate incompatible name/order changes, and record the executable revision used by each run. A duplicate-name check catches ambiguity inside one definition; it does not by itself make upgrades safe.

## Limitations

- Scout inspected selected files at one commit and did not execute the Maven test suite, reproduce a JVM restart, or test SQLite/Postgres durability under faults.
- The tests are project-authored evidence. They demonstrate intended contracts in deterministic cases, not linearizability, crash consistency, or multi-process safety in deployment.
- The approval test uses an in-memory effect journal and timer store shared across recreated service objects. It proves callback semantics and re-arming at that layer, not persistence across an actual process loss; production durability still depends on wiring persistent timer and effect-journal backends correctly.
- Repository search returned `incomplete_results=false`, but that only describes this query result, not exhaustive coverage of GitHub or of all durable-agent runtimes.
- Popularity and a broad adapter matrix do not establish production maturity or security.

## Sources

- Search feed (`incomplete_results=false`): https://api.github.com/search/repositories?q=%22AI+agent%22+%22event+sourcing%22+in%3Areadme&sort=updated&order=desc&per_page=20
- Repository: https://github.com/Atmosphere/atmosphere
- Pinned revision: https://github.com/Atmosphere/atmosphere/commit/c01c50ccd426328979f6ae6f77e79aa4c1875b77
- Root README: https://github.com/Atmosphere/atmosphere/blob/c01c50ccd426328979f6ae6f77e79aa4c1875b77/README.md
- Checkpoint contract: https://github.com/Atmosphere/atmosphere/blob/c01c50ccd426328979f6ae6f77e79aa4c1875b77/modules/checkpoint/README.md
- Workflow runner: https://github.com/Atmosphere/atmosphere/blob/c01c50ccd426328979f6ae6f77e79aa4c1875b77/modules/checkpoint/src/main/java/org/atmosphere/checkpoint/workflow/Workflow.java
- Step contract: https://github.com/Atmosphere/atmosphere/blob/c01c50ccd426328979f6ae6f77e79aa4c1875b77/modules/checkpoint/src/main/java/org/atmosphere/checkpoint/workflow/WorkflowStep.java
- Durable approval expiry: https://github.com/Atmosphere/atmosphere/blob/c01c50ccd426328979f6ae6f77e79aa4c1875b77/modules/checkpoint/src/main/java/org/atmosphere/checkpoint/DurableApprovalExpiry.java
- SQLite cold-resume test: https://github.com/Atmosphere/atmosphere/blob/c01c50ccd426328979f6ae6f77e79aa4c1875b77/modules/checkpoint/src/test/java/org/atmosphere/checkpoint/workflow/WorkflowSqliteResumeTest.java
- Approval-expiry tests: https://github.com/Atmosphere/atmosphere/blob/c01c50ccd426328979f6ae6f77e79aa4c1875b77/modules/checkpoint/src/test/java/org/atmosphere/checkpoint/DurableApprovalExpiryTest.java
