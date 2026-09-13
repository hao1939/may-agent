# Design and implementation gaps

**Status:** Active index of known source gaps at the [documentation baseline](../README.md).
Conversation/storage entries include the focused `99bc1a31` review and the
subsequent merges of #127 and #129. Naming and Conversation/state separation
are complete in source; the [storage review](storage-state-service.md#candidate-review-and-landing-order)
records that evidence. This is not a deployment audit or a second subsystem backlog.

Start with [System Model](../2a-design/system-model.md) and
[Architecture](../2a-design/architecture.md). Each row below points to the owner
of the remaining contract and its acceptance criteria.

| Gap or open decision | Owner and next proof |
| --- | --- |
| One Task lifecycle and Conversation execution | [Accepted baseline](conversation-input-unification.md): explicit outcomes and owner closure, one execution Task per Conversation; replace mode rules and duplicate inbox execution; prove result correlation, scoped controls, routes and retained-state migration |
| Current-turn redirection | [Request follow-through review](task-runtime-organization.md#request-follow-through-review): Stop then correction survives SQLite reopen in fixtures; add immediate steering only when its value is demonstrated |
| Request and owner-decision behavior in use | [Message Lifecycle](../2a-design/message-lifecycle.md#current-implementation-and-gaps) and [Request follow-through review](task-runtime-organization.md#request-follow-through-review): core correction, non-success and closure boundaries pass deterministic checks; live recognition, scope and truthful closure still need usage evidence |
| Recovery query cost | [Core review plan](task-runtime-organization.md): measure realistic scan and responsiveness cost before optimizing |
| External capability scope and complexity | [External component plan](external-components-simplification.md#conditional-follow-ups): Scout credential fix landed on workspace main; Host #132/#133 merged as `23968acd`/`39a23f22`; further features/migrations require demonstrated value |
| Contract-and-convention observer integration | [Observer feedback proposal](observer-feedback-and-resource-conventions.md): Host publication-aware observation memory is present at v3.0.1; App adoption and one convention-based GitHub source still need integration proof |
| Common feedback model, CLI progress and truthful status | [One execution feedback model](execution-feedback-and-review.md): align existing paths; fix demonstrated progress/status gaps. Review during execution and automatic fallback are deferred, not prerequisites |
| System path reduction and readable code ownership | [System simplification review](authority-boundary-simplification.md#design-choices-before-code-moves): compare Task-only conversational delegation, evaluation UI reduction and affordable redo; selected import/navigation and foreground-App changes are in review; larger deletions remain conditional |
| Remaining central domain metrics | The migration rule below and [Metrics](../2a-design/metrics.md) |
| Accepted child-wait retirement, Evaluation/HTTP policy, behavioral comparison and delivery proof | [Authority proposal](authority-boundary-simplification.md#remaining-work): separate bounded work, with its existing scope limits |

Input containment and Esc/Stop bindings merged in #121. Dispatch-failure pacing
and cancellation of pending capacity waits merged in #127 (`743aa5de`). These
are source fixes; their deployment is a separate operating decision.
Correlated failure events are also implemented; the
[core review](task-runtime-organization.md#4-improve-failure-evidence-through-existing-events)
records their existing publishers and containment checks. Further diagnostics
should answer a demonstrated operating question.

## Remaining metric ownership migration

Host maintenance still has a central `ALL_METRICS` catalog. Scout and Evaluation
already own several migrated measurements; Runtime samples persisted
`sourceQuery` and `sourceCommand` definitions on the existing snapshot event,
respecting each definition's `measureInterval`.

Classify remaining entries, retain small Host-owned runtime measurements, and
move demonstrated domain meaning to its accountable App one metric at a time.
Preserve the question, source, denominator, evidence and interval. Verify the
App definition and Host sampling path; add no second scheduler or lifecycle.

## Maintaining this index

Keep detailed decisions and tests with their owner. Remove a row when its
source contract and checks converge; keep any deployment work explicit and
separate. The [previous tracker](../archive/implementation/convergence-review-through-20260908.md)
preserves earlier migration evidence and scoped decisions.
The [documentation audit](../archive/reviews/documentation-clarity-20260909.md)
records retired JSON/Condition items; they are not current implementation gaps.
