# Design and implementation gaps

**Status:** Source review index refreshed against Host `1ff18acc` and workspace
`7f95373b96` on 2026-09-27. This is not a live deployment or App-quality audit.
The [documentation review](../archive/reviews/design-doc-hygiene-20260927.md)
records checks and corrections. Current contracts live in
[System Model](../2a-design/system-model.md), [Architecture](../2a-design/architecture.md)
and their linked owners.

## Confirmed implementation gaps

| Gap | Evidence and contract owner | Smallest next proof |
| --- | --- | --- |
| HTTP embeds session-evaluation policy and directly writes human annotation | `src/app/http/server.ts`; [HTTP boundary](../2a-design/http-boundary.md), [Session trail](../2a-design/session-eval-trail.md) | Preserve the current API while routing the requested judgment/write to its owner; prove exact session/line/input correlation |
| Requested session line/instructions are lost at the Evaluation mapping | `evaluation.app/app.ts`, `evaluate-session` mapping and `evaluator-aftermath`; [Session trail](../2a-design/session-eval-trail.md) | Either implement the accepted annotation capability end to end or explicitly revise/remove that advertised capability; do not claim a whole-session assessment answered the line request |
| Some Task-board text equates convergence with recurring work | `packages/webui/static/pages/project-kanban.js`; [Default UI](../2a-design/default-project-ui.md) | Explain open accepted outcomes independently of recurrence and closure; check the rendered board |
| Domain metrics and reports remain partly centralized | Maintenance App `ALL_METRICS` and named-agent HTTP report filters; [Metrics](../2a-design/metrics.md) | Move demonstrated domain meaning to its App while retaining factual Host measurement and existing readers |

## Intentional limits and evidence still needed

These are not additional implementation assignments merely because they appear
here. Apply the value/cost review before extending the contract.

| Limit or unanswered question | Current rule and next evidence |
| --- | --- |
| Immediate redirection of a running Conversation Turn | New input is retained for the next claim; exact Stop is implemented. [Turn control](../2a-design/human-control-surfaces.md#current-turn-control) distinguishes it from live steering. Demonstrate need before adding more control paths. |
| Explicit incorporation of live workflow input | Executor acknowledgments exist, but generic workflow callbacks only observe; refreshed model context is also a read. [Workflow input](../2a-design/workflows.md#input-during-execution) preserves pending input for later reconciliation. Demonstrate avoidable repeated work before extending the acknowledgment surface. |
| Automatic supervisor fallback and review inside awaited helpers | [Ownership boundary](../2a-design/system-boundary.md#ownership-and-intervention) keeps these deferred. Unresolved ownership is retained evidence; it is not proof a human saw a `/todo`. Verify an explicit responsible route when that guarantee is needed. |
| Agent judgment and the installed improvement loop | Follow exact report → investigation → candidate → comparison → approval → application → fresh behavior. [Learning loop](../2a-design/practice-learning-loop.md) owns common boundaries; App contracts own decisions. Component tests do not certify that sequence. |
| Recovery efficiency at installation scale | Measure indexed query/dispatch behavior and actual backlog before optimizing. [Task runtime](../2a-design/task-resource-engine.md#pause-reload-and-recovery) owns recovery; age/count alone is not proof of a defect. |
| Skill-level regression comparison | Catalog pinning is intentional. The [skill contract](../2a-design/skills.md#current-implementation-and-remaining-work) records identity, but hash-to-outcome comparison needs distinct evaluation evidence. |

## Resolved source drift

The following are implemented, not open migrations: one Task lifecycle,
direct input attachment, accepted Request storage, Turn Stop/Esc/button bindings,
shared Task/Conversation reads, scoped helper cleanup, exact legacy feedback
routing, command-source metric batching and standalone deployment receipts.
The documentation previously mixed their old implementation plans with current
contracts. Their dated proposals remain evidence, not a current backlog.

## Remaining metric ownership migration

The maintenance App source retains `ALL_METRICS`. App declarations can own
`sourceQuery`/`sourceCommand` measurements on the existing cadence. Preserve the
question, source, denominator, evidence and interval when moving an entry.
Do not introduce another scheduler or remove a historical sample to change
ownership. The installed App definitions determine which measurements run.

## Maintaining this index

Keep a gap only with a source location, its owning requirement and a closing
proof. Remove resolved rows; keep dated evidence at its existing path. A new
source review can revise this index without inventing runtime work or claiming
deployment. Historical [convergence evidence](../archive/implementation/convergence-review-through-20260908.md)
and [earlier documentation review](../archive/reviews/documentation-clarity-20260909.md)
remain available.
