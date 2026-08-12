---
title: "Orchigram — Durable Runs Need Semantic Closure, Not Just Plan Hashes"
source: github
date: 2026-08-08
last_updated: 2026-08-08
type: finding
tags: [github, agent-workflows, durability, reproducibility, plugins, orchestration]
relevance: high
---

Repo: https://github.com/alexrett/orchigram

# Orchigram — Durable Runs Need Semantic Closure, Not Just Plan Hashes

## Summary

Orchigram is a new local-first Go orchestrator that treats agent workflows as durable, declarative resources. Its strongest design choice is to compile each Flow into an immutable execution plan and bind a Run to the plan hash, so editing the Flow after a crash does not silently change the recovered run.

The repository also exposes a subtler durability boundary: **a plan hash does not reproduce a run unless every executable meaning behind that plan is pinned too**. At the checked revision, task execution resolves whichever plugin version is active when a node is dispatched, and the stored interpreter-version field is not used to select or reject an interpreter implementation. The project has several pieces of semantic pinning, but not yet semantic closure.

## Primary evidence

- **Repo:** https://github.com/alexrett/orchigram
- **Revision checked:** [`f319d46c39f799ad75a52da491421e77905a4f15`](https://github.com/alexrett/orchigram/commit/f319d46c39f799ad75a52da491421e77905a4f15)
- **GitHub metadata:** https://api.github.com/repos/alexrett/orchigram
- **Search feed:** https://api.github.com/search/repositories?q=topic%3Aai-agents&sort=updated&order=desc&per_page=20

At that revision:

1. **Trigger acceptance and run dispatch cross a transactional boundary.** The durability contract says an acknowledged trigger writes its receipt and outbox command in one SQLite transaction. Reconciliation may redispatch, but the occurrence identity maps to one local Run UID.

2. **Run recovery pins declarative intent.** The compiler hashes a normalized `ExecutionPlan` containing the Flow UID and generation, interpreter-version string, nodes, edges, retry policy, loop limits, and other execution data. If reconciliation finds that the Run already exists, the orchestrator reloads the plan by the Run's stored plan hash instead of recompiling the latest Flow. A fault-injection test edits the Flow between a simulated crash and recovery and asserts that the original plan is reused.

3. **External effects are explicitly at-least-once.** Every plugin call receives a stable idempotency key derived from run, node, logical iteration, and operation. The documentation correctly identifies the unavoidable crash window after a remote effect succeeds but before local completion is recorded.

4. **Plugin artifacts are immutable by `(name, version, digest)`.** Installation verifies bundle and binary digests, refuses a different digest under an existing version, and preserves installed versions for activation and rollback. Backups include the workflow databases and installed plugin files.

5. **But a Run does not pin its provider version.** A plan node stores an action such as `github.workspace.checkout`, not a plugin version or digest. `Manager.Execute` extracts the plugin name and calls `activeProcess`, which loads the globally active installation at dispatch time. Enabling another version during a long-lived or approval-blocked Run can therefore change the code that executes a later node without changing the Run's plan hash.

6. **The interpreter version is recorded, not enforced.** Runs and compiled plans store `generic-v1`, and the workflow engine registers `InterpreterWorkflow` under `orchigram.interpreter.v1`. In the checked code, `InterpreterWorkflow` does not branch on or validate `plan.InterpreterVersion`, and startup does not visibly block a Run whose stored version differs from the current constant. Keeping the registration name stable while changing its implementation would leave the version field descriptive rather than an executable compatibility gate.

## Why it matters

Durable agent workflows are unusually sensitive to semantic drift because they can pause for approvals, retries, schedules, or human review while the control plane is upgraded. Replaying the same graph is insufficient if any of these change underneath it:

- interpreter implementation;
- plugin or tool implementation;
- model/profile configuration;
- policy and permission semantics;
- referenced repository, secret, or environment configuration; or
- schemas used to interpret prior outputs.

A useful run identity therefore needs a **semantic closure manifest**: plan hash + interpreter implementation/version + provider digests + policy/config revisions + immutable references for other behavior-bearing dependencies. Recovery should either resolve that exact closure or enter a visible blocked/migration state. It should never silently substitute the currently active implementation.

This does not require freezing secret values into the plan. References can remain late-bound where freshness is intentional, but the system should mark that choice explicitly as dynamic and record the resolved provenance at each activity.

## Practical pattern

For a durable agent runtime:

1. Compile editable workflow resources into an immutable plan.
2. Resolve every action to a provider version and digest when the Run is accepted, or declare the binding intentionally dynamic.
3. Route each activity through the Run's binding, not the global active pointer.
4. Give each interpreter revision a distinct executable registration and reject or migrate unsupported revisions before replay.
5. Record the actually resolved provider, model/profile, policy, and configuration provenance on every activity event.
6. Preserve those artifacts in backup/restore and garbage-collect them only when no retained Run references them.
7. Keep stable idempotency keys across retries; pinning semantics does not remove the external side-effect crash window.

## Calibration

This is an architectural signal from a repository created on 2026-08-08, with 0 stars, 0 forks, no tags, and a `v1alpha1` API at retrieval. The repository is substantial—roughly 23.9k lines of Go in the shallow checkout and 94 Go test functions—but Scout could not execute its suite because the environment has no Go toolchain. The finding distinguishes code-observed behavior from the stronger durability promise in the documentation; it is not a production-maturity claim.

## Sources

- **Repo:** https://github.com/alexrett/orchigram
- **Revision:** https://github.com/alexrett/orchigram/commit/f319d46c39f799ad75a52da491421e77905a4f15
- **README:** https://github.com/alexrett/orchigram/blob/f319d46c39f799ad75a52da491421e77905a4f15/README.md
- **Durability contract:** https://github.com/alexrett/orchigram/blob/f319d46c39f799ad75a52da491421e77905a4f15/docs/durability.md
- **Plan compiler:** https://github.com/alexrett/orchigram/blob/f319d46c39f799ad75a52da491421e77905a4f15/internal/flow/compiler.go
- **Crash-boundary recovery test:** https://github.com/alexrett/orchigram/blob/f319d46c39f799ad75a52da491421e77905a4f15/internal/orchestrator/orchestrator_test.go
- **Durable engine:** https://github.com/alexrett/orchigram/blob/f319d46c39f799ad75a52da491421e77905a4f15/internal/engine/engine.go
- **Plugin dispatch and activation:** https://github.com/alexrett/orchigram/blob/f319d46c39f799ad75a52da491421e77905a4f15/internal/pluginmanager/manager.go
- **Security model:** https://github.com/alexrett/orchigram/blob/f319d46c39f799ad75a52da491421e77905a4f15/docs/security.md
