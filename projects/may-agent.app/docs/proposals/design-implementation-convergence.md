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
| Current-turn redirection | [Core review plan](task-runtime-organization.md#3-validate-redirection-and-request-follow-through): start with Stop then a correction; add immediate steering only when its value is demonstrated |
| Request and owner-decision behavior in use | [Message Lifecycle](../2a-design/message-lifecycle.md#current-implementation-and-gaps) and [controller proposal](task-controller-pattern.md#remaining-implementation-and-review): extend bounded evidence for correction, restart, scope and truthful closure; storage, retry and finite Task stop mechanics are merged |
| Correlated failure evidence | [Core review plan](task-runtime-organization.md#4-improve-failure-evidence-through-existing-events): identify exact work, stage and disposition through existing events/reads; investigation does not gate settlement |
| Recovery query cost | [Core review plan](task-runtime-organization.md): measure realistic scan and responsiveness cost before optimizing |
| External capability scope and complexity | [External component plan](external-components-simplification.md#conditional-follow-ups): Scout credential fix landed on workspace main; Host #132/#133 merged as `23968acd`/`39a23f22`; further features/migrations require demonstrated value |
| System path reduction and readable code ownership | [System simplification review](authority-boundary-simplification.md#design-choices-before-code-moves): compare Task-only conversational delegation, evaluation UI reduction and affordable redo; selected import/navigation and foreground-App changes are in review; larger deletions remain conditional |
| Remaining central domain metrics | The migration rule below and [Metrics](../2a-design/metrics.md) |
| Accepted child-wait retirement, Evaluation/HTTP policy, behavioral comparison and delivery proof | [Authority proposal](authority-boundary-simplification.md#remaining-work): separate bounded work, with its existing scope limits |

Input containment and Esc/Stop bindings merged in #121. Dispatch-failure pacing
and cancellation of pending capacity waits merged in #127 (`743aa5de`). These
are source fixes; their deployment is a separate operating decision.

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
