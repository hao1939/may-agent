# AKS RP E2E Agent App

This app organizes work for the sibling `aks-rp-e2e` domain project. It uses
the convention-first Agent App reconciliation model.

## Mental model

```text
subscribed fact or periodic resync
  -> app resolves desired task identity
  -> one app work queue deduplicates the task key
  -> generic reconciler compares desired and observed state
  -> bound workflow runs, otherwise the resolved owner runs
  -> reconciler validates and atomically applies result actions/Conditions
```

- The app organizes.
- A task records desired and observed state; it does not schedule work.
- A workflow preserves a repeatable process learned by agents.
- An agent supplies adaptive capability and is the ownership fallback.
- The runtime owns delivery, attempts, concurrency, retries, recovery, and
  persistence.

## App contract

`app.ts` declares:

- one accountable owner: `app-ops`;
- one `tasks.subscriptions` selector list and one `tasks.resolve` function;
- schedules that publish semantic facts only;
- actions that translate into validated canonical App inputs; and
- no task routes, owner-entry wrapper, workflow map, or manual event graph.

A task with `workflow: "name"` resolves
`agents/<resolved-owner>/workflows/name.ts` by convention. A
task without a workflow runs its explicit or inherited owner. If a workflow
returns `needs-agent`, the same task falls back to that owner for exceptional
judgment. The fallback does not take over mechanics owned by the learned
workflow; it corrects the same task and resumes that workflow, or records an
exact external wait/escalation when the required action is outside the owner
boundary.

Every task workflow completes with a canonical execution result whose output is
one reconciliation envelope:

```ts
{
  state: "converged" | "waiting" | "needs-agent";
  summary: string;
  evidence: string[];
  actions?: TaskAction[];
  conditions?: Condition[];
}
```

Handlers never write task storage directly. `converged` may carry bounded
follow-up actions. `waiting` always carries exact typed Conditions observed by
domain watchers.

## Active workflows

- `focus-plan` — observation-only focus proposal/progress review.
- `project-stall-review` — observation-only liveness diagnosis.
- `approval-dispatch` — idempotent human approval packet delivery.
- `problem-solver` — bounded evidence-backed problem investigation.
- `spec-loop-controller` — reconciles the app-owned ledger against a detached
  clean `origin/dev` catalog snapshot, declares bounded sibling actions, then
  converges once every current spec is represented.
- `feature-compact-loop-controller` — observes compact-loop state and declares
  bounded sibling actions, then converges once current work is represented.
- `normalize-scenario-frontier` — observes strict scenario-test inventory on
  clean `origin/dev` and declares bounded one-spec normalization work.
- `scenario-test-inventory` watcher — also observes the strict inventory from a
  detached clean `origin/dev` worktree, so dirty local repair files cannot add
  or hide frontier rows.
- `wait-for-repo-ref-advance` — preserves a same-spec publication wait on a
  machine-observable repo-ref Condition such as `aks.repo-ref.changed`.

The two loop workflows support multiple independent loop task IDs. Focus
events may likewise target independent focus task IDs.

## State

- `.state/tasks/state.json` — host-private mutable task resource authority;
  App code never reads or writes it.
- `.state/tasks/tree.json` — generated disposable read projection.
- `.state/spec-loop/state.json` — spec verification domain ledger.
- `.state/feature-compact-loop/state.json` — compact-package domain ledger.
- `.state/*-runs.jsonl` — workflow evidence ledgers.
- `project.json` — durable project intent, policy, and accepted planning direction; it never mirrors live task state.

Finished `achieve` tasks leave the live graph after their outcome is absorbed
into a bounded completion receipt. Reusable experience belongs in workflows,
skills, design, and domain evidence—not in an ever-growing live task archive.

## Commands

```bash
bun run syntax
bun run typecheck
bun run test
bun run check
```

The canonical design is [Agent App](../may-agent.app/docs/2a-design/agent-app.md),
with migration rationale in [Canonical Agent App
migration](../may-agent.app/docs/3-proposals/canonical-agent-app-migration.md).
