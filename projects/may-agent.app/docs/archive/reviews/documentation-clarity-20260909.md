# May documentation clarity review

**Historical context:** [System Model](../../2a-design/system-model.md). Retained rationale and evidence; this record does not define the current contract.

**Status:** Historical review; the documentation corrections and consolidation were applied on 2026-09-09.
**Date:** 2026-09-09.
**Source baseline:** Host `de2c1699a2df7d5391ffb277b7b490687a6c60e7` (PR #95).

The documentation has a coherent underlying model, but it is not yet a reliable
single account of that model. The largest problem is several versions of the
same contract remaining in the current reading path. Some copyable examples
are invalid, some implementation gaps are already fixed, and important current
behavior appears only in a proposal.

Correct those claims first. Then reduce repetition around a small overview,
one owning page per contract, and short practical guides. Keep the existing
folders initially; a directory migration would not repair these problems.

## Cleanup applied

The current [System Model](../../2a-design/system-model.md),
[App Contract](../../2a-design/agent-app.md),
[Task engine](../../2a-design/task-resource-engine.md), and
[Storage](../../2a-design/storage.md) incorporate the confirmed corrections.
The README now offers three audience paths. The SDK links executable types;
one [App/wait example](../../examples/app.ts) and its
[structural seed](../../examples/seed.json) are checked against source SDK
TypeScript, actual in-memory Task admission/replay and production result
admission by the existing design check. The seed was added after checking that
an empty store does not invent the Task's parent. The adoption and Task authoring guides use that example.

Startup, direct work, Conditions, invalid results, HTTP Task views, Console,
metrics, evaluation and scoped-read descriptions were corrected. The old JSON
cutover procedure was archived with its removal commit. The active convergence
tracker retains source work still open. The core separation proposal remains
proposed work; this cleanup did not implement or certify those separations.

Validation after cleanup: `bun run check:may-design` passed the structural,
example and canonical App checks with zero errors and six existing root-layout
warnings. A separate check found no missing local targets or unresolved heading
anchors in active documentation. No Host behavior or deployment changed.

The findings below describe the pre-cleanup audit, not continuing defects in
the updated pages. Historical evidence and the per-document recommendations
are retained for review; they are not another current contract or backlog.

## Scope and evidence

### Follow-up cleanup on September 9

A second review corrected the cross-App result example, admission milestones
and dependency identity guidance. The shared example check now admits both
Condition and cross-App dependency results and typechecks the control client.
The quickstart includes agent setup, activation, publication and exact reads.
It still requires a working installation/model; no live model run was performed.

Current implementation pages use the README's main-checkout baseline; candidate
startup behavior and its recorded validation remain in the core proposal.
The authority proposal now retains only current rules, remaining decisions and
acceptance; its earlier text and dated pilot are archived. The full design
check passed with the same six layout warnings, all local links and active
heading anchors resolved, and `git diff --check` passed.

### Initial inventory

The starting inventory contained 99 Markdown files: 5 principles, 32 current
designs, 10 manuals, 4 proposals/trackers, 46 archive files, and README/INDEX.
The current-design folder alone contained approximately 61,000 words.

The review covered the roles, status claims, terminology, navigation, and
overlapping contracts across the 53 active/navigation files. Selected
implementation claims and copyable examples were checked against Host source.
Archive review covered navigation and historical labeling; historical designs
were not tested as if they were current contracts. This is not exhaustive
verification of every command, schema, SQL query, or deployment claim.

The App/docs working tree already contained concurrent changes. A local audit
snapshot was retained, and the major findings below were rechecked against the
working files. The core proposal was being refined during review; its current
shared-scheduling direction is acknowledged here. App source observations refer
to the working tree, not a verified deployed installation.

## Corrections to make first

### 1. The public model understates what May can do directly

[System Model](../../2a-design/system-model.md) says the bounded conversational
frontend answers, clarifies, or admits intent, and does not perform destination
work. [Core Principles](../../1-principles/core-principles.md),
[Agent App](../../2a-design/agent-app.md), and
[Task Resource Engine](../../2a-design/task-resource-engine.md) also contain broad
statements that every actionable App input goes through a Task.

The September 8 decision in
[One Fact, One Owner](../../proposals/authority-boundary-simplification.md) explicitly permits
May to investigate, edit, and verify self-contained authorized work directly.
Current [request execution](https://github.com/hao1939/may-agent/blob/de2c1699a2df7d5391ffb277b7b490687a6c60e7/src/app/app-request-agent.ts)
contains that instruction and supplies bounded App tools. Its
[tests](https://github.com/hao1939/may-agent/blob/de2c1699a2df7d5391ffb277b7b490687a6c60e7/src/app/app-request-agent.test.ts) exercise direct
file work and interrupted execution. This is a source-backed documentation
mismatch, not merely an unimplemented idea.

Use one rule throughout: a Task owns an ongoing commitment requiring
continuation, later steering, or restart-safe coordination. A bounded
conversational turn can finish authorized work directly. Tool use alone does
not require a Task, and creating a Task does not necessarily mean delegating
to another App. Existing Task ownership and specific operation authority still
apply. Keep the detailed May policy in Message Lifecycle; other pages link it.

### 2. Three App examples do not compile against the SDK

The complete `defineApp` examples in
[SDK Quickstart](../../2b-manual/sdk-quickstart.md),
[Handler Authoring](../../2b-manual/handler-authoring.md), and
[App Adoption](../../2b-manual/agent-app-adoption-playbook.md) were extracted
unchanged and typechecked against the current SDK. All three failed.

They read `input.kind` or `input.data` directly and return a bare intent or
`null`. The actual [App contract](../../../../may-agent/packages/sdk/src/app.ts)
supplies `AppTaskInput` with `{ id, source, input }`; its `task` callback
returns an `AppTaskAttachment`: `{ kind: "existing", taskId }` or
`{ kind: "desired", intent }`. `tasks.resolve(event)` is a different callback
and can return a Task intent or `null`.

Handler Authoring also names `AppTaskDependency`; the SDK exports
`TaskAppDependency`. This is why duplicating whole TypeScript contracts in
several manuals is expensive.

Maintain one small, executable App example as the quickstart's source. Explain
the two mapping callbacks beside it. Adoption should be a checklist and Task
authoring should cover result behavior, both linking the same example.
Compile the copyable example in the existing check path; mark incomplete
sketches as sketches.

### 3. Wait and failure instructions disagree with current admission

The Task engine's status header and
[convergence tracker](../../proposals/design-implementation-convergence.md) list required
Condition ownership as unfinished. The engine's own Conditions section says
new Conditions require `owner` and `reviewAfterMs`.

Current [result admission](../../../../may-agent/packages/sdk/src/task-contract.ts)
requires a canonical owner and an integer review interval of at least 60,000
milliseconds. Optional fields in the
[TypeScript Condition type](../../../../may-agent/packages/sdk/src/task.ts)
preserve readability of historical state; they do not make those fields
optional on new writes.

The Handler Authoring wait example omits `owner`. Passing that exact Condition
through production admission returns:

```text
conditions[0].owner must be a canonical non-empty identity
```

Adding `owner: "app:pipeline"` makes that result admissible. The guide also
says returning the same Condition resets its checkpoint, while
[Workflows](../../2a-design/workflows.md) specifies preserving an unchanged future
deadline and renewing it when due.

The Task engine has another internal contradiction: mechanism selection puts
rejected handler results in attention, but the Result Contract groups invalid
results with exceptions and says they are retried. Current
[Task runtime](https://github.com/hao1939/may-agent/blob/de2c1699a2df7d5391ffb277b7b490687a6c60e7/src/app/app-task-runtime.ts) distinguishes
`HandlerResultInvalid` attention from execution failure retries, with a
[regression](https://github.com/hao1939/may-agent/blob/de2c1699a2df7d5391ffb277b7b490687a6c60e7/src/app/app-task-runtime.test.ts) covering
recovery of rejected results.

Replace these scattered statements with one outcome table: valid result,
external wait, unavailable capability, invalid result, transient execution
failure, cancellation, and stale fence. Separately state historical-read
compatibility. Do not describe implemented source behavior as only a pilot
candidate; keep deployment verification separate.

### 4. Storage documentation omits the central authorities

[Storage](../../2a-design/storage.md) describes SQLite mainly as bounded metadata,
indexes, and projections. Its record table omits Tasks, attempts, accepted
results/receipts, Conditions, requests, frozen admission records, and
Conversation/Topic relationships. The Host README calls SQLite a durable index,
and the user guide labels `may.db` a query/projection store.

The actual [Task resource store](https://github.com/hao1939/may-agent/blob/de2c1699a2df7d5391ffb277b7b490687a6c60e7/src/app/app-task-resource-store.ts),
[request store](https://github.com/hao1939/may-agent/blob/de2c1699a2df7d5391ffb277b7b490687a6c60e7/src/app/app-inbox-store.ts),
[admission store](https://github.com/hao1939/may-agent/blob/de2c1699a2df7d5391ffb277b7b490687a6c60e7/src/app/app-event-admission-store.ts), and
[Conversation store](https://github.com/hao1939/may-agent/blob/de2c1699a2df7d5391ffb277b7b490687a6c60e7/src/app/conversations/store.ts) contain
authoritative durable state. An operator must not infer that the database can
be discarded and rebuilt from transcripts.

Keep one table with columns **record, authority, storage, rebuildable from
what**. Distinguish authoritative SQLite rows, immutable artifact files, and
disposable projections. Scope the file-before-projection write sequence to
artifact-backed records; it is not the transaction model for every resource.

### 5. Startup order contradicts itself

[Architecture](../../2a-design/architecture.md) and the Startup diagram in
[Runtime](../../2a-design/runtime.md) put recovery before external ingress. The
same Runtime page's Recovery section, and
[App Operations](../../2b-manual/app-operations-recovery.md), say interfaces open
first and isolated Task recovery runs asynchronously.

Current [startup composition](../../../../may-agent/src/app/app-runtime.ts) and
[Cron startup](https://github.com/hao1939/may-agent/blob/de2c1699a2df7d5391ffb277b7b490687a6c60e7/src/app/cron-startup.ts) support the latter:
interfaces are wired before bounded recovery, and Task controllers start after
that initial recovery pass settles. Ingress readiness and Task execution
readiness are different gates.

Own one startup/reload/shutdown sequence in Runtime. Architecture should link
it and show only the composition points. Document current Task activation's
dependency on `--cron` as a real implementation gap; schedule independence in
the core proposal is a target, not current behavior.

### 6. A recovery guide invokes removed migration code

App Operations instructs users to run `scripts/cutover-task-resources.ts`
with `inspect`, `pause`, and `activate`. That script is absent from current
Host source. The convergence tracker still proposes removing
`legacyTaskStateConfig`, which is also absent from current `src`, `packages`,
and `scripts`. The generic Task store now requires resource authority.

Move the old cutover procedure to a version-qualified historical migration
record and remove it from the normal restart path. If an old installation
still needs migration, identify the exact supported migration release and
procedure; do not invent a replacement command. Remove the obsolete constructor
item from the current source backlog after checking any remaining supported
release obligations. JSON-shaped payloads and seed snapshots are not the old
mutable whole-App JSON authority.

### 7. The HTTP page describes an internal resource as the public response

[HTTP Boundary](../../2a-design/http-boundary.md) says Task reads share the shape
`{ kind, metadata, spec, status }`. The SDK's
[TaskView and TaskDetail](../../../../may-agent/packages/sdk/src/workflow.ts)
are flat views containing `id`, `status`, `generation`, `outcome`, and other
bounded fields. The [HTTP handler](../../../../may-agent/src/app/http/server.ts)
returns the shared daemon Task read directly. The Task engine doc itself also
describes the flat view.

Label the internal stored resource and public read view explicitly. Link the
public type from HTTP instead of restating it. Human-control projections may
add presentation fields; they are not another Task authority.

### 8. Implementation-status paragraphs have drifted

Two clear examples:

- [Console](../../2a-design/may-console.md) lists duplicate terminal-result
  suppression and direct responsible-Task watching as unfinished.
  [Human Control Surfaces](../../2a-design/human-control-surfaces.md) says they
  are implemented. Current
  [Console source](../../../../may-agent/packages/terminal/bin/may-console.cjs)
  tracks Conversation results by exact Task and suppresses the supporting
  terminal snapshot; its
  [tests](../../../../may-agent/packages/terminal/src/may-console.test.ts)
  exercise direct `followTask` admission.
- [Scheduling](../../2a-design/cron.md) says both an App schedule and Cron produce
  Host metric snapshots. [Metrics](../../2a-design/metrics.md) and the convergence
  tracker say Cron is the sole scheduler. Current working `app.ts` has no
  metric-snapshot schedule; the declaration is in tech-lead's `cron.json`.

Fix the stale status at the owning page. A short source-qualified status is
useful; a duplicated paragraph of recent fixes and open work is a second
backlog. Avoid unqualified claims about what is running in production.

### 9. Peripheral pages still teach retired or differently scoped capabilities

[Evolution](../../1-principles/evolution.md) demonstrates `sdk.escalate`, while the
current SDK has no such public capability and
[Escalation](../../2a-design/escalation.md) uses exact Conditions and typed Task
dependencies. [Sessions](../../2a-design/sessions.md) recommends an SDK/query
surface, and [Heartbeat](../../2a-design/heartbeat.md) refers to an SDK heartbeat
helper without identifying a current public contract.

[Session Evaluation Trail](../../2a-design/session-eval-trail.md) says the App
writes the evaluations table and that human-owner labels route findings to
May. Current Evaluation workflows emit `evaluation.recorded`, and the Host's
[DB writer](../../../../may-agent/src/lib/db-writer.ts) applies that projection.
[Practice Learning](../../2a-design/practice-learning-loop.md) and Events require
explicit App routes rather than a generic owner fallback.

Update the named boundaries. Keep legitimate Host-private and standalone-agent
operations clearly scoped; do not present them as App SDK capabilities. Put
the evaluation evidence format in its own short reference and link the one
learning pipeline, rather than describing two pipelines.

## A simpler reading model

Two axes need one explicit explanation:

| Question | Boundary |
| --- | --- |
| Who decides what work means and whether it is complete? | App policy versus Host mechanics |
| What must remain correct when a capability is removed? | Stable core versus replaceable capabilities |

Core and external are not synonyms for Host and App. A Console adapter can be
Host code and still be replaceable. An executor implementation can be optional
even though completing a particular Task requires a suitable executor.

The agreed direction in
[Stable Core and Replaceable Capabilities](../../proposals/task-runtime-organization.md) keeps
events, authoritative state, generic Task/attempt control, and shared timing
mechanics in the core. Schedule declarations, observers, execution adapters,
interfaces, and reporting are capabilities around it. Events connect changes
and wakes; transactional local calls and bounded executor calls remain ordinary
typed calls. Do not imply a broker, plugin framework, separate processes, or
an event for every function invocation.

The overview should state the agreed principle:

> Removal should degrade capability, while preserving the remaining system's correctness.

Link the proposed absence-behavior table and clearly label separation still
to be implemented. Preserve source/deployment distinctions while that work is
under review.

## Organization without a large move

Use the existing folders with narrower jobs:

| Reading need | Existing home | Keep there |
| --- | --- | --- |
| Start and choose a path | README and INDEX | Three audience paths; one authority map |
| Understand the system | System Model | A short glossary, one work example, ownership and replaceability |
| Understand requirements | Principles | Durable invariants and decision rules |
| Change Host code | Architecture and owning design pages | Actual composition, dependency direction, contracts and failure behavior |
| Build an App | One quickstart, SDK, Task/workflow guides | A working example, public capabilities and authoring rules |
| Operate an installation | Manuals | Version-scoped commands, expected evidence, recovery steps |
| Review a proposed change | Proposals | Current decision, alternatives, remaining work and acceptance |
| Understand earlier choices | Archive and Git history | Superseded designs, migration procedures and dated evidence |

Retain one technical owner for each core contract: Events owns publication and
admission guarantees; Task Resource Engine owns Task transitions and result
admission; Storage owns persistence authority; Runtime owns process startup,
shutdown, and recovery composition; Scheduling owns shared timing and schedule
registration. Architecture maps those responsibilities to actual code and
links their contracts. It should not repeat their protocols.

For code decoupling, keep current source mapping separate from the proposed
layout. A capability page should identify its entry contract, resource owner,
dependencies, and behavior when absent. The core proposal owns the proposed
code organization; this documentation cleanup should not introduce a competing
directory plan or prescribe new packages.

Aim for a five-minute System Model, not a compressed reference manual. App
authors should reach a working example before being asked to read seven design
documents. Adapter pages should explain transport-specific behavior and link
the shared human contract.

## Document-by-document disposition

These are proposed editorial actions, not claims that every implementation
behind a retained page has been verified.

### Principles

| File | Suggested disposition |
| --- | --- |
| `core-principles.md` | Keep as governing invariants; qualify Task-only statements and link the bounded-turn rule. |
| `work-model.md` | Keep responsibility/mechanism decisions; reduce repeated lifecycle and May narratives. |
| `code-vs-data.md` | Keep as the main small mechanism-choice guide; link it from Evolution. |
| `evidence-first.md` | Keep; retain the reusable method and move dated case evidence out of the main path. |
| `evolution.md` | Shorten to promotion/retirement rationale; remove obsolete SDK examples and duplicated mechanism tables. |

### Current design

| File | Suggested disposition |
| --- | --- |
| `system-model.md` | Make it the compact entry point; fix direct-work policy and explain the two boundary axes. |
| `architecture.md` | Keep actual composition and code map; link lifecycle contracts and correct startup ordering. |
| `system-boundary.md` | Own Host/App dependency rules; explain where proposed core/capability boundaries fit. |
| `storage.md` | Repair the authority table first; retain bounded artifacts, retention and transaction rules. |
| `app-root-layout.md` | Keep the canonical filesystem map; link it instead of copying directory trees elsewhere. |
| `agent-app.md` | Own declarations, validation and admission; distinguish `task` from `tasks.resolve`; link May policy. |
| `projects.md` | Keep project context, source/workspace and posture; remove repeated Task mechanics. |
| `task-resource-engine.md` | Keep the core Task contract; unify waits/failure outcomes; move migration and pilot narration out. |
| `agents.md` | Keep execution-profile identity and cooperation; clearly scope standalone compatibility behavior. |
| `runtime.md` | Own startup/readiness, capacity, process modes and shutdown; link Task/executor details. |
| `sessions.md` | Keep execution evidence, persistence and resumption; correct generic SDK-query guidance and scope legacy paths. |
| `workflows.md` | Keep bounded execution and Task result mapping; link the authoritative Task schema and deadline rule. |
| `sdk.md` | Keep capability boundaries and source links; avoid independently maintained copies of full types. |
| `native-coding-workers.md` | Lead with the current Task executor path; separate `codex-goal` from one-shot/tool compatibility; move operator recipes to a guide. |
| `skills.md` | Keep discovery/invocation contract; replace wording that leaves work ownership in sessions/workflows. |
| `events.md` | Own publication, admission, routing and retention; link Conversation policy and move event-loop implementation detail below the public contract. |
| `event-graph.md` | Keep trace provenance, bounded reads and graph behavior; remove repeated May lifecycle narrative. |
| `cron.md` | Keep timing and registration contracts; fix snapshot status and distinguish current activation coupling from proposed independence. |
| `heartbeat.md` | Explain heartbeat as an ordinary App pattern; name current capabilities and link scheduling/observer mechanics. |
| `metrics.md` | Keep sampling, alert semantics and attribution; separate Host mechanics from App measurement policy and open catalog migration. |
| `guards.md` | Keep modes and raw-signal meaning; distinguish diagnostic attribution from an explicit work route. |
| `escalation.md` | Keep the ownership-boundary decision guide; link exact Condition/dependency contracts instead of copying them. |
| `practice-learning-loop.md` | Own the end-to-end evaluation/learning pipeline and its explicit App routes. |
| `session-eval-trail.md` | Narrow to evidence format and read/write boundary; correct table-write and owner-routing claims. |
| `human-control-surfaces.md` | Own shared commands, resource identity, watch and human-action semantics. |
| `message-lifecycle.md` | Own May turn/Topic/follow-through behavior; incorporate the implemented direct-work rule. |
| `may-console.md` | Keep Console-specific interaction and failure behavior; fix stale status and link shared semantics. |
| `telegram-notifications.md` | Keep provider coordinates, formatting and reconnect behavior; link shared commands and May lifecycle. |
| `http-boundary.md` | Keep HTTP admission/read mapping; correct public Task shape and link SDK types. |
| `default-project-ui.md` | Keep project-specific read/steer behavior; link shared Task and human-action projections. |
| `webui.md` | Keep route/navigation and browser behavior; link individual resource contracts and the current terminal design. |
| `web-terminal.md` | Keep ttyd/Herdr ownership and absence behavior; remove conflicting terminal-profile wording from referring pages. |

### Manuals

| File | Suggested disposition |
| --- | --- |
| `sdk-quickstart.md` | Make this the single tested App getting-started example; fix its callback contract. |
| `handler-authoring.md` | Retitle to Task reconciler authoring; fix result/Condition examples; separate the final Host-handler section. |
| `workflow-authoring.md` | Keep a practical workflow guide; use the shared valid Task result example and current loader contract. |
| `agent-app-adoption-playbook.md` | Keep as a short checklist; link the quickstart instead of copying a different App. |
| `agent-convention.md` | Keep authoring conventions; link canonical layout and distinguish App-local from standalone paths. |
| `user-guide.md` | Put normal Console use first; scope development/direct-agent operations and correct database authority wording. |
| `app-operations-recovery.md` | Keep normal recovery and release verification; archive the removed cutover command with its supported version. |
| `event-runtime-audit.md` | Keep operational queries; distinguish admission, projection, trace and Task evidence. |
| `guard-runtime-audit.md` | Keep focused observational queries and reviewed-outcome guidance. |
| `metric-alerts.md` | Keep the small evidence-to-action procedure and explicit responsibility rule. |

### Navigation, proposals and history

| File/group | Suggested disposition |
| --- | --- |
| `README.md` | Shorten to the model and builder/operator/maintainer paths; avoid another detailed May description. |
| `INDEX.md` | Retain the existing question-to-authority table; make it the sole complete catalog. |
| `task-runtime-organization.md` | Keep the current core/capability review active; link completed extraction evidence rather than letting it obscure the current proposal. |
| `design-implementation-convergence.md` | Remove resolved Condition and absent-constructor work; retain verified open gaps with a source baseline. |
| `authority-boundary-simplification.md` | Promote implemented direct-work rules into their owning designs; retain genuinely open decisions and move earlier pilot narration to history. |
| `authority-boundary-pilot-20260906.md` | Treat as dated verification evidence; link from the active proposal and archive when its reporting role is complete. |
| `archive/` (46 files at audit start) | Preserve history; ensure pages reached directly state that current design supersedes them and link the relevant owner. Do not rewrite historical examples to resemble today's SDK. |

## Lightweight maintenance rules

1. **One rule, one owner.** Other documents give a short explanation and link it.
   Keep the existing authority table rather than introducing a documentation registry.
2. **Separate requirement, source behavior, and deployment evidence.** Keep the
   existing design/implementation fields concise. A conflicting implementation
   is a recorded gap, not a reason to silently rewrite the requirement or claim
   compliance. A merged change is not proof of rollout.
3. **Use precise scopes.** Say durable App work, bounded conversational turn,
   Task attempt, or standalone maintenance. Avoid unqualified “all work” and
   overloaded “handler.”
4. **Test what readers copy.** Start with the single App quickstart and a valid
   result/Condition example. Link executable types; do not build a new docs
   generator or try to test every illustrative sketch.
5. **Move finished history out of current contracts.** Keep rationale when it
   explains a live tradeoff; put PR chronicles, snapshots and migration steps
   under versioned history.
6. **Lead with the ordinary path.** Explain purpose, contract, failure/absence
   behavior, then implementation references. Put compatibility and advanced
   details afterward. Prefer one running example to repeated negative rules.

## Repair order and completion

First repair the false contracts and broken examples: direct work, App mapping,
Conditions/failures, storage authority, startup order, HTTP shape, removed
commands, and stale status. These should be small documentation changes tied
to exact source evidence.

Next consolidate repeated explanations at their owning pages. Keep the current
filenames while moving text and fixing links. Restructure navigation last;
rename or merge a page only when its content no longer has an independent job.

The cleanup is complete when a new reader can follow one valid App example,
identify authoritative state, distinguish admission from completion, explain
bounded turns versus durable Tasks, and find each lifecycle/absence contract
without reconciling contradictory pages. The active tracker should contain
only current open work.

## Validation performed

- The existing design-integrity check passed with zero errors and six existing
  root-layout warnings (`.azure`, `.tmp`, `.tools`, `archives`, `tmp`, `worktrees`).
- A local check of non-archive Markdown link targets found no missing local
  files. This checked file existence, not every heading anchor or semantic claim.
- The three unchanged App examples failed SDK typechecking as described above.
- The exact manual Condition failed production result admission; adding its
  canonical owner passed. This proves that small contract, not an end-to-end App.
- A scan of literal script references identified the removed cutover script.
- No live runtime, deployment, model call, or state migration was used for this
  review. The previously run core suite is separate evidence, not a full
  documentation or production certification.

The initial review added only its report and index link. The subsequent cleanup
is recorded above; unrelated working-tree changes were preserved.
