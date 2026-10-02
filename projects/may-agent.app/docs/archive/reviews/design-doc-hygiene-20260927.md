# Design documentation review — 2026-09-27

**Historical context:** [System Model](../../2a-design/system-model.md). Retained rationale and evidence; this record does not define the current contract.

This is a source and documentation review, not deployment or model-behavior
verification. Host baseline: `1ff18acc` (includes #252/#253). Workspace baseline:
`7f95373b96`. The source reading guide now names that Host baseline.

## Scope and method

Reviewed navigation and scanned all 52 current documents: 6 principles,
33 designs, 11 manuals, README and INDEX. Checked their links, headings,
implementation-status claims, lifecycle vocabulary, source references and public
API examples. Traced the mismatched claims through their owning source modules
and current App declarations. Historical proposals and archives were inspected
where linked; this was not a rewrite of every historical record or a fresh
behavioral audit of every deployed App.

Current authority remains in the owning design. Dated trials retain their
original paths and claims. The navigation no longer advertises old PR status
as current work. No live records were moved, archived or rewritten.

## Findings and corrections

| Finding | Classification | Correction and evidence |
| --- | --- | --- |
| README/INDEX advertised merged migrations and old trials as current work | Documentation drift | Replaced the rollout digest with reading paths and stable record links; checked source at the named baseline |
| `achieve`/`maintain`, accepted outcomes and closure were mixed across UI/SDK docs | Contract explanation conflict | One Task lifecycle; `TaskView.status=done` is accepted convergence, `closed` is separate, human views use `up-to-date`; SDK `task.ts`/`workflow.ts`, `human-task-service.ts` |
| Handoff continuation was called unsupported | Documentation drift | `waiting` supports `continue: true`, alongside independent waits and reports; SDK `TaskReconcileResult`, `attempt-runner.ts`, `deferAppTask()` |
| Runtime/App/Event docs described a deferred executing inbox coordinator and its capacity queue | Documentation drift | Direct admission and atomic input attachment; only Task attempts consume execution capacity; `app-inbox-host.ts`, `state/inbox.ts`, `controller.ts` |
| Recovery docs promised silence/error-count stopping and automatic standalone revival | Documentation drift | Task recovery preserves evidence and applies paced retry; standalone resume requires a caller; `startup-recovery.ts`, session recovery and manager execution scope |
| Legacy escalation feedback was described as resuming a session | Documentation drift | Saved provenance resolves to an exact Task or explicit unresolved feedback; `escalation-feedback.ts`, `db-writer.ts` |
| Esc, Requests and contextual controls were described as unavailable | Documentation drift | Updated user manual and design against Console bindings, Conversation state and integration tests; live steering remains limited |
| Old Task boards were described as reading a whole path-based snapshot | Documentation drift plus a remaining UI-copy defect | Current board uses `/api/tasks` and `/api/task`; optional tree/grouping guidance is distinguished from shipped paging; `project-kanban.js`, `task-read-routes.ts` |
| Examples required `evidence` where SDK requires `facts`; removed aliases appeared as exports | Documentation drift | Corrected fields, names and source links; checked examples against source SDK |
| Metrics/workflow/native-worker refinements were labeled pending after implementation | Documentation drift | Updated batching, workflow cancellation/result retention and exact native resume against their source owners |
| Workflow support table still called shared context a candidate and described every brief as an attempt-start snapshot | Documentation drift with a retained capability limit | Managed-agent context refreshes before model requests; workflow invocation context remains a snapshot. Executor acknowledgment exists, but generic workflow event callbacks only observe. Checked SDK `TaskAttempt`, `attempt-execution.ts`, `workflow-tool.ts` and context integration |
| Common learning docs assigned intake, preparation and promotion to Gym | Ownership mismatch in the documentation | Current Gym only compares; Evaluation reviews external Tasks; May and assigned workers own decisions/preparation/application; checked the three App declarations and owning designs |
| A pinned skill catalog was described as a failed adoption path | Intentional limit misclassified as a gap | Fresh execution adopts the active definition; existing prepared executions stay pinned. Outcome comparison by hash is a separate capability |
| Layout text prescribed moving evidence into archives | Guidance conflicted with stable-record policy | Keep record paths stable; clean worktrees only after their unique work is handled |
| HTTP Evaluation ownership and selected-line loss remain in source | Implementation gaps | Retained in the convergence index with exact owner and required proof; did not weaken the accepted contract |

## Clarifications to the design

These changes clarify the established model rather than introduce new machinery:

- A result's discriminated union chooses an attempt settlement operation. It does
  not declare all Task facts mutually exclusive. Progress, accepted outcomes,
  failures, Conditions, pending input and more work can coexist.
- A local awaited operation and a durable dependency share responsibility and
  evidence rules, but have different lifetime guarantees. Continuing after a
  durable handoff means another bounded pass, not resuming a saved JavaScript stack.
- Conversation Requests, input receipts, Tasks and execution sessions answer
  different questions. None should be inferred complete from another's label.
- Gym comparison, human approval and application are distinct responsibilities.
  Current common design links App-owned policy instead of duplicating it.
- Layout suggestions and UI grouping are guidance. Exact identity, accepted-state
  preservation and result/closure boundaries are contracts.
- External Event ingress and internal typed admission retain input identity and
  caller correlation. Pure mapping/attachment can run synchronously; asynchronous
  execution does not require a second input coordinator.

## Gaps retained

See the [convergence index](../../proposals/design-implementation-convergence.md).
Confirmed source gaps are HTTP-owned Evaluation behavior, loss of requested
session line/instructions, residual recurring-work UI wording and centralized
domain metric/report policy. Immediate Turn steering and automatic supervisor
fallback are explicitly limited/deferred; this review did not authorize or
implement new mechanisms for them.

Saving an unresolved failure does not prove someone received a human action.
Likewise, report publication, candidate comparison, source commit, activation
and improved behavior need their own exact evidence. This review cannot certify
the installed improvement loop or future agent judgment.

## Validation

Final validation passed:

- `bun run check:may-design`: design integrity reported zero errors/warnings;
  SDK/control examples and seeded Task admission/replay plus Condition/dependency
  result admission passed; canonical App boundary check reported zero errors.
- A local Markdown link/anchor scan covered 55 documents and 722 references,
  with no unresolved local targets or anchors. Remote URLs were not checked.
- `git diff --check`: passed.

The final readability pass also shortened repeated Task-view prose after the
existing document-size check caught the page limit. No model calls, live-state
operations or deployment are part of this review.

The integrity check is structural. It passed before the semantic drift was fixed;
its success alone cannot establish design/source agreement. On a public-contract
change, review the owning rule and affected manuals together rather than adding
a second documentation authority or a mandatory daily review service.
