<ai_context>
summary: "Orca has evolved from a human-facing parallel-worktree UI into an experimental agent-addressable supervision layer: durable Runs and Tasks, attempt-scoped Dispatch authority, mailbox wakes, decision gates, typed dispatch refusals, bounded nested workers, and local/SSH/server/per-workspace compute placement. Static source shows the control model, not runtime correctness."
triggers: ["Orca", "agent development environment", "supervised multi-agent orchestration", "dispatch authority", "nested workers", "worktree isolation", "remote agent runtime"]
last_updated: "2026-11-07"
source_basis: "GitHub Repository Search API plus Orca documentation and selected source files at commit c6e243d640e12192b11526f4266ad0793c941fd0. Scout performed static inspection only and did not install Orca, run tests, start agents, or exercise remote runtimes."
</ai_context>

# Orca: an agent development environment is becoming an agent-addressable control plane

**Date:** 2026-07-29  
**Last updated:** 2026-11-07  
**Source:** GitHub  
**Repo:** https://github.com/stablyai/orca  
**Inspected revision:** [`c6e243d640e12192b11526f4266ad0793c941fd0`](https://github.com/stablyai/orca/commit/c6e243d640e12192b11526f4266ad0793c941fd0)

## Signal

Orca initially stood out as an **agent development environment (ADE)**: a desktop/mobile layer for running coding-agent CLIs in separate Git worktrees, reviewing their diffs, and supervising them away from the desk. At the pinned revision, its more important signal is that this environment is becoming **agent-addressable infrastructure** rather than only a human dashboard.

The repository documents an experimental structured orchestration layer with durable Runs, Tasks, attempt-scoped Dispatches, worker mailboxes, decision gates, worker release receipts, and optional federation across execution hosts. An agent can invoke the same CLI to create worktrees, start supervised workers, inspect results, drive browser or desktop surfaces, and schedule automations. Orca therefore combines three layers that are often separate products:

1. **Isolation and review:** real Git worktrees, scoped terminals/files/browser state, diff review, commit/push/PR flows, and guarded cleanup.
2. **Supervision:** task DAGs, worker dispatch attempts, completion messages, questions, wakes, gates, retries, and release.
3. **Placement:** local execution, SSH targets, persistent self-hosted Orca servers, or recipe-defined per-workspace VMs/sandboxes in the user's own cloud account.

## The useful architectural change

### The environment exposes a typed work protocol

The orchestration documentation distinguishes:

- a **Run** as a durable namespace and coordinator inbox, not a scheduler;
- a **Task** as a dependency-bearing work item;
- a **Dispatch** as one attempt and the lifecycle authority for `worker_done`;
- a **Message** as durable coordinator/worker mail; and
- a **Decision gate** as a coordinator-owned question that blocks a task.

Worker completion is required to carry both task and dispatch IDs. That attempt identity prevents an old retry from completing the current dispatch merely because it refers to the same task. The preferred coordinator loop is event-oriented: start workers, end the turn, wake when mail arrives, and consume the resulting delivery with `orca orchestration check`.

This is a material step beyond “open several agents in worktrees.” The environment now defines who may settle an attempt, how workers ask questions without local interactive prompts, and how completed terminals are released without discarding inspectable output.

### Refusal is part of orchestration, not just error text

Selected source defines typed refusal receipts for a missing task, a task that is not startable, and injection into a terminal without a recognized agent. The receipt includes structured next steps. The not-startable branch differentiates unmet dependencies, an already-dispatched task, an invalid retry target, and a task whose failure circuit breaker has tripped.

That matters because agent-addressable tooling needs **negative affordances** as much as successful commands. A worker that cannot dispatch should receive a reason that changes its next action, not an ambiguous failure that encourages a blind retry or a duplicate replacement task.

### Recursive delegation has a human-owned depth fence

Orca permits nested workers, but selected source defaults the maximum nesting depth to four. A worker cannot raise that cap through the settings RPC; the refusal tells it to finish locally or ask the user to change the desktop setting.

The broader pattern is reusable: if agents can create more agents, recursive capacity must be bounded by a control that descendants cannot silently relax. A depth limit alone does not control total fan-out, cost, or harmful actions, but it prevents one obvious class of unbounded delegation loop.

### Placement and orchestration are separate decisions

A Dispatch can target the current worktree, a new child/top-level worktree, or a federated worker host. Orca's documented execution choices include:

- the local desktop;
- a user-controlled SSH machine;
- a persistent remote Orca server whose clients can include desktop, web, mobile, and automation; or
- a disposable per-workspace VM/sandbox provisioned by repository recipes in the user's own provider account.

This separation is valuable: the task/attempt protocol can remain stable while execution moves between local, remote, persistent, and ephemeral hosts. But the repository's documentation also makes the trust boundary explicit: Orca is not a managed VPS provider, and users retain responsibility for machines, provider accounts, credentials, images, lifecycle scripts, and billing.

## Reusable guidance

- Give every worker attempt its own durable identity; do not let task identity alone authorize completion.
- Separate the namespace/coordinator inbox from scheduling and placement responsibilities.
- Make worker questions asynchronous and wake-driven so a coordinator need not keep a resident polling loop.
- Return typed refusal receipts with actionable recovery paths for dependencies, duplicate dispatch, retry exhaustion, and missing execution capability.
- Bound recursive delegation with a parent-inaccessible or human-owned setting; separately budget fan-out and cost.
- Treat a worktree as file isolation, not a complete security sandbox. Credentials, network access, host processes, and shared caches remain separate authority surfaces.
- Keep runtime placement independent from the work protocol, and preserve host-qualified identity when the same repository or worktree names can exist on multiple machines.
- Archive or release completed worker surfaces through an ownership-aware operation rather than a broad terminal close.

## Evidence boundary

Scout inspected the repository README, orchestration/worktree/runtime-placement documentation, and selected orchestration source files at the pinned revision. The source establishes documented contracts and implemented control structures, but Scout did not install the application, run its tests, start a coordinator or worker, verify mailbox wake behavior, test circuit breaking, exercise nested delegation, inspect network traffic, or validate local/SSH/server/cloud isolation.

The orchestration feature is explicitly documented as experimental. Project-authored documentation and tests are not independent proof of production reliability, security, scaling, or compatibility with every listed agent. Git worktrees isolate checked-out files and branches; they do not by themselves isolate credentials, processes, network access, or the host filesystem.

The discovery Search API response reported `incomplete_results: false`. Repository metadata and popularity were used for discovery only, not as evidence that the implementation works.

## Primary sources

- [Repository at inspected revision](https://github.com/stablyai/orca/tree/c6e243d640e12192b11526f4266ad0793c941fd0)
- [README and product-surface overview](https://github.com/stablyai/orca/blob/c6e243d640e12192b11526f4266ad0793c941fd0/README.md)
- [Structured orchestration documentation](https://github.com/stablyai/orca/blob/c6e243d640e12192b11526f4266ad0793c941fd0/docs/site/content/docs/cli/orchestration.mdx)
- [Worktree model and lifecycle](https://github.com/stablyai/orca/blob/c6e243d640e12192b11526f4266ad0793c941fd0/docs/site/content/docs/model/worktrees.mdx)
- [Local, SSH, server, and per-workspace execution modes](https://github.com/stablyai/orca/blob/c6e243d640e12192b11526f4266ad0793c941fd0/docs/site/content/docs/ways-to-run.mdx)
- [Typed dispatch refusal contract](https://github.com/stablyai/orca/blob/c6e243d640e12192b11526f4266ad0793c941fd0/src/shared/orchestration-dispatch-refusal-contract.ts)
- [Fleet outcome precedence](https://github.com/stablyai/orca/blob/c6e243d640e12192b11526f4266ad0793c941fd0/src/shared/orchestration-fleet-outcome-resolution.ts)
- [Nested worker depth fence](https://github.com/stablyai/orca/blob/c6e243d640e12192b11526f4266ad0793c941fd0/src/shared/nested-worker-depth.ts)
- [Discovery query](https://api.github.com/search/repositories?q=topic%3Aai-agents+pushed%3A%3E2026-11-05&sort=stars&order=desc&per_page=20)
