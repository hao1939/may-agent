# Task + Watcher PR use-case source trial — 2026-11-16

Historical validation evidence, not a contract or deployment receipt. The current
owners are the [Task reference case](../../2a-design/task-resource-engine.md#solid-use-case-a-pr-through-ci-and-review),
[watcher contract](../../2a-design/agent-app.md#task-driven-resource-observation)
and [Alex delivery recipe](../../development-workflow.md#publishing-and-waiting-for-github-pull-request-facts).

## Candidate and scope

Apps baseline: `8b61797a53`. Host checkout used by the trial: `3f3662188c`.
The candidate extracts the existing GitHub reader into shared App code, retains
May's state/review contract, and composes Alex's watcher with explicit head-bound
CI and comment coverage. No Host source, production Task state, GitHub resource,
activation or deployment was changed.

This is the standard Task model: one retained outcome, bounded agent/workflow
actions, watcher facts and same-Task continuation. It adds no PR state machine,
watch registry, Task-per-comment route or always-running workflow.

## Evidence observed

| Check | Result and scope |
| --- | --- |
| Focused App/provider/development/closure regressions | **149 passing tests across 7 files**, including the automated Host-composition test |
| Task + Watcher composition | **7 passing assertion groups**, production Alex detector with production Host resource observation, event admission and Task reconciliation |
| Existing May live composition | Passed ownership, quiet scans, busy-owner return, failed event-publication retry, restart and failure-subscription assertions |
| Existing May exact recovery composition | Passed saved/shared reads, merge during downtime, failed event publication, same-Task wakes and stopping removed/cancelled interests |
| `bun run typecheck` | Passed shared source/SDK/root type checks |
| `bun run check:may-design` | Passed contract structure, SDK examples, canonical Apps and model surface |

The new connected case retains publication progress and original acceptance,
waits without model polling, receives CI failure/comment changes after restart,
repairs/rearms the same PR on the same Task, and receives a comment correction
that arrived between readback and accepted result. It rejects old-head CI as
current evidence, stops PR reads when interest ends, preserves an independent
approval and reports completion only after that requirement returns.

Provider regressions cover CI-only changes without PR `updated_at` changes,
comment edits beyond bounded previews, explicit partial failures/truncation,
exact head and ownership confirmation, authenticated fixed-endpoint pagination,
cancellation, bounded total request/preview budgets and fair live traversal.
The real-Git `develop-change` regression confirms feedback reaches judgment and
causes a new verified local candidate rather than quiet reuse of an old pass.

## Reproduce

From the Apps candidate with its explicit Host dependency:

```sh
bun test ./shared/tools/github-pull-request.test.ts \
  ./projects/may.app/watchers/github-pull-request.test.ts \
  ./projects/may.app/app.test.ts ./projects/alex.app/app.test.ts \
  ./projects/alex.app/task-completion.test.ts \
  ./projects/alex.app/agents/alex/workflows/develop-change.test.ts \
  ./projects/alex.app/watchers/github-pull-request.test.ts --timeout 45000

HOST_CANDIDATE=/app/projects/may-agent \
  bun projects/alex.app/scripts/task-pr-watcher-composition.ts /tmp/task-pr-watcher.json

bun run typecheck
bun run check:may-design
```

The [maintained probe](../../../scripts/task-pr-watcher-composition.ts) records
its assertions and limits. The [automated test](../../../watchers/github-pull-request.test.ts)
runs it using the checkout's explicit Host dependency and temporary state.

## What this does not prove

- Host fixture Apps `sample`/`peer`/`builds` rebind detector source identity;
  Alex declaration/source binding and live owner routing are separate App/unit
  checks. This is not an installed Alex smoke Task.
- GitHub HTTP, PR publication and agent decisions are fixtures. Failed
  **event** publication is tested; retry/readback after a lost **PR creation**
  response is not. No native agent delivered a live PR during this trial.
- CI coverage contains check runs and combined commit statuses, not required
  branch-protection rules. Comments/reviews do not establish unresolved-thread
  state or acceptance. Missing/truncated coverage remains explicit.
- The watcher's repository scope is read-only. It does not redirect Alex's Apps
  workspace or make Apps-local development receipts evidence for Host code.
- Before claiming deployment support, activate the intended definitions through
  the normal authorized path and verify a saved interest, durable matching event
  and accepted later owner result. Verify actual authorized PR publication and
  original-outcome acceptance separately.
