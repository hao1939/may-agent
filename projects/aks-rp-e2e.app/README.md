# AKS RP E2E Agent App

This app organizes work for the sibling `aks-rp-e2e` domain project. It uses
the convention-first Agent App reconciliation model.

## Mental model

```text
event or periodic resync
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
- one `tasks.accepts` selector list and one `tasks.resolve` function;
- schedules that emit semantic events only;
- actions that translate directly to semantic events; and
- no task routes, owner-entry wrapper, workflow map, or manual event graph.

A task with `workflow: "name"` resolves
`agents/<resolved-owner>/workflows/name.ts` by convention. A
task without a workflow runs its explicit or inherited owner. If a workflow
returns `needs-owner`, the same task falls back to that owner for exceptional
judgment. The fallback does not take over mechanics owned by the learned
workflow; it corrects the same task and resumes that workflow, or records an
exact external wait/escalation when the required action is outside the owner
boundary.

Every handler returns one envelope:

```ts
{
  state: "converged" | "waiting" | "needs-owner";
  summary: string;
  evidence: string[];
  actions?: ProjectAppTaskAction[];
  conditions?: ProjectAppConditionSpec[];
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
- `spec-loop-controller` — observes spec-loop state and declares bounded
  sibling actions, then converges once current work is represented.
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

- `.state/tasks/state.json` — sole mutable task resource authority.
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

The canonical design is
[`app-task-reconciliation-model.md`](../may-agent.app/docs/3-proposals/app-task-reconciliation-model.md).
