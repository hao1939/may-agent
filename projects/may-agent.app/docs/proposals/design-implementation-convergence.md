# Design and implementation gaps

**Status:** Active index of known source gaps at the [documentation baseline](../README.md).
This is not a deployment audit or a second subsystem backlog.

Start with [System Model](../2a-design/system-model.md) and
[Architecture](../2a-design/architecture.md). Each row below points to the owner
of the remaining contract and its acceptance criteria.

| Gap or open decision | Owner and next proof |
| --- | --- |
| Input dispatch, recovery and reporting containment | [Core review plan](task-runtime-organization.md#implementation-order-and-candidate-decisions): attach cleanup before fallible reads, contain detached recovery, and make diagnostics best effort; [post-merge reproductions](../archive/reviews/core-implementation-post112-20260910.md) |
| Esc/Stop-button bindings and clear command help | [Human controls](../2a-design/human-control-surfaces.md#current-turn-control): reuse merged durable Stop, replace Console `/stop`, separate Task controls from Host administration |
| Current-turn redirection | [Core review plan](task-runtime-organization.md#3-validate-redirection-and-request-follow-through): start with Stop then a correction; add immediate steering only when its value is demonstrated |
| Request and owner-decision behavior in use | [Message Lifecycle](../2a-design/message-lifecycle.md#current-implementation-and-gaps) and [controller proposal](task-controller-pattern.md#remaining-implementation-and-review): extend bounded evidence for correction, restart, scope and truthful closure; storage, retry and finite Task stop mechanics are merged |
| Correlated failure evidence | [Core review plan](task-runtime-organization.md#4-improve-failure-evidence-through-existing-events): identify exact work, stage and disposition through existing events/reads; investigation does not gate settlement |
| Further atomic storage operations | [Storage proposal](storage-state-service.md): extract only a demonstrated consistency boundary; the request attachment slice is merged |
| Recovery query cost | [Core review plan](task-runtime-organization.md): measure realistic scan and responsiveness cost before optimizing |
| Remaining central domain metrics | The migration rule below and [Metrics](../2a-design/metrics.md) |
| Retained conversational child waits, Evaluation/HTTP policy, behavioral comparison and delivery proof | [Authority proposal](authority-boundary-simplification.md#remaining-work): separate bounded work, with its existing scope limits |

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
