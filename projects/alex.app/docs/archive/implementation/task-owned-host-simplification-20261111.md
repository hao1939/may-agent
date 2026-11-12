# Task-owned Host simplification — source integration record

**Supports:** [Carry work through interruption](../../2a-design/system-model.md#carry-work-through-change-and-interruption) with one durable work owner and a smaller execution surface.

Status: merged in [Host #449](https://github.com/hao1939/may-agent/pull/449) on
2026-11-11 at `7d32fa337890e2ec04e0d7de8a026637952c0b2b`. Companion Apps source
landed directly on its `main` at `271af002206cd39d3c792e26a889dbffd1537320`.
No deployment, service restart, live state conversion or model-backed acceptance
was performed for this change. A source receipt does not identify installed
behavior.

## Decision and contract owners

Tasks own unfinished work. Sessions and workflow runs record bounded execution
evidence. After confirmed process and descendant cleanup, the same Task may
start a fresh attempt under its ordinary policy.

| Decision | Current owner | Deliberate loss/cost |
| --- | --- | --- |
| Retire configurable Host maintenance, reload/private API and cron editing | [Scheduling](../../2a-design/cron.md) | Old duties need explicit migration; fixed retention, watchdog/liveness, metrics and App schedules remain |
| Retire workflow `resume` and historical step replay | [Workflows](../../2a-design/workflows.md#crash-recovery) | Fresh attempts may repeat work; inspect receipts/destinations before effects. Normal guards and bounded repair remain |
| One App input/Task contract and common Conversation communication | [App contract](../../2a-design/agent-app.md), [Conversation execution](../../2a-design/conversation-execution.md) | Retired aliases/execution formats require explicit stopped conversion; no hidden fallback |
| Retire cold Host session reconstruction and obsolete lease compatibility | [Sessions](../../2a-design/sessions.md) | Ended standalone sessions cannot resume or reuse execution identity. Live steering and native CLI thread continuity remain |

Accepted input/result identity, Requests, Topics, return links, process ownership,
confirmed descendant cleanup, usage, cancellation and atomic stale-result fences
remain. Human Request scope belongs to the accepting Task. Conversation uses its
App's canonical workspace unless an explicitly selected workflow requires a
worktree. Saved input bindings preserve cancelled/closed Conversation lineage;
fresh human input creates a linked successor instead of reopening it.

Workload accounting, protected funding/capacity, workflow repair guards, event
graph design, model-step refresh and TaskTree command redesign were outside this
change. They were not removed by the broader DeepSeek comparison proposal.

## Review corrections

- Restore persisted event bodies through the verified loader before selector
  matching and input mapping, including inline, artifact and pre-envelope rows.
- Refuse ambiguous, corrupt, orphaned or mixed pending subscription/Task routes
  atomically. Never turn malformed state into silently dropped work.
- Reserve retired executor name `conversation` at admission, registration and
  dispatch, including custom adapters. Its owning App must explicitly migrate
  a custom adapter's retained specifications under a new name.
- Use one accepted-live-input snapshot for reply selection, Request checks and
  final coverage. Convergence cannot consume an input with an open accepted ask;
  independent scopes remain answerable.
- Stop mixed chat/ordinary batches: end considered chat inputs, retain ordinary
  inputs and their return links for a fresh attempt, preserve newer chat, and
  reject the stopped attempt's late result. Regressions include rollback,
  continued inputs, storage reopen and the installed interruption/controller path.
- Check the actual legacy checkpoint at `pendingSettlement.report.conversation`
  during startup and conversion. Retired proposals block both without mutation;
  common Task checkpoints remain supported.
- Retain `main`'s #450 test consolidation and #451 captured-helper execution fix
  while keeping the simplified contracts and retired suites removed.

All seven review threads were resolved before merge. The additional checkpoint
finding in the review summary was fixed as well.

## Measured change

Physical lines relative to Host `main` at
`ad34d8c51e0f745698f33b09ab330590c88ecd27` and the companion Apps change base.
Implementation includes SDK and offline operations. These counts are not token,
latency, memory or throughput benchmarks.

| Area | Added | Deleted | Net reduction |
| --- | ---: | ---: | ---: |
| Host implementation / SDK / operations | 855 | 3,983 | 3,128 |
| Companion App implementation / checks | 81 | 76 | -5 |
| Combined implementation | 936 | 4,059 | **3,123** |
| Host tests / fixtures | 1,752 | 13,133 | 11,381 |
| Companion App tests / fixtures | 310 | 110 | -200 |

Removed test suites owned retired adapters. Enduring behavior is covered through
common paths; the deleted test lines are not runtime savings.

## Verification and limits

The final PR head was `afde37ee4d2aa2f79260f13f824bf0ef2a335612`, whose merged
source is recorded above. `MAY_TEST_SHARDS=4 bun run ci` passed: **4,104 passed,
3 optional installed-configuration skips, 0 failures**, across 356 files.
Host/SDK typechecks, canonical App boundaries and ESLint errors passed. Real
browser, daemon, process and scripted worker coverage executed. Both GitHub
**Quality** and **Container** checks passed on that exact head, and the pinned
publication scan found no leaks.

Affected helper/CLI suites after merging #451: **96 passed, 0 failures** across
six files. Eleven conversion/contract regressions and three mixed-batch Stop
cases cover the additional review fixes. The converter CLI's earlier isolated
empty-state dry-run/apply checks prove command wiring; retained-state behavior
is covered by fixtures, not a live upgrade.

Companion Apps evidence at the unchanged paired App revision, previously
verified with Host `3c1522e162b758c7d8ab6cae13b81b0278e92930`: **84 passed,
0 failures** across five files; both affected App TypeScript projects passed.
Seven checker regressions and the design gate passed, with the then-existing
`reports/` layout warning. These are historical source checks, not a claim that
App checks were rerun against the final Host head or a deployed bundle.

May's optional model-backed `poc/intent-learning` experiment still targets the
retired adapter. Keep its historical findings; port it separately before running
it again. No model-quality, performance or live-activation result is claimed.

Post-merge documentation validation used an isolated Apps checkout with the
updated documentation and Host source matching the merged tree. Document
integrity, typed SDK/control examples, Task/Condition admission examples and
canonical App boundaries passed, with one existing `reports/` layout warning.
The changed-document and incoming-link audit found no broken file or heading
targets. The shared workspace's full design gate remains blocked by unrelated
`evaluation.app` and `gym.app` directories without `app.ts`; its earlier stages
passed. These checks establish documentation consistency, not live activation.

## Upgrade boundary

The current [operations guide](../../2b-manual/app-operations-recovery.md#upgrade-retired-task-contracts)
owns the procedure: inventory old duties, finish cleanup/old settlements using
the previous Host, exclude every launcher/ingress/worker, verify a consistent
SQLite/WAL backup, dry-run real conversion, inspect identities, and apply while
still stopped. Activation requires its own authority.

The converter preserves Task generation/readiness, accepted history, input and
Request identity and exact Condition targets. Frozen old Conversation admissions
and retained proposals must be settled first. A confirmation flag cannot prove
external process exclusion. Never blindly restore an old snapshot after new
work was accepted. This procedure is not a replacement replay engine or an
exactly-once guarantee for external effects.
