# Human Action Task View

**Historical context:** [Human Control Surfaces](../../2a-design/human-control-surfaces.md). Retained rationale and evidence; this record does not define the current contract.

> Historical record. Use the [current contract index](../../INDEX.md) for present behavior; dated claims below describe their original review.


**Status:** Accepted on 2026-08-24. Current authority is
[human-control-surfaces.md](../../2a-design/human-control-surfaces.md),
[task-resource-engine.md](../../2a-design/task-resource-engine.md), and the
Console and Telegram adapter designs.

## Decision to test

Human attention is not another queue. It is a view over Tasks that are already
waiting on an explicit, unsatisfied human-owned Condition.

```text
Task
  -> open Condition with owner `human` or `human:<role>`
  -> /todo derived view
  -> Conversation presents the exact Task reference
  -> human response enters May with that Conversation/Task context
  -> May continues the exact owning Task
  -> accepted Task reconciliation removes or satisfies the Condition
  -> item disappears from /todo
```

`attention`, failure, elapsed time, and a transport delivery state do not make
a Task a human action. They may need an App owner or Host repair instead.

## Small interface

- `/todo` shows open human actions for the selected App.
- `/todo all` shows them across Apps.
- `/watch <ref>` follows one Task. While watched, ordinary text is feedback for
  that exact Task through May.
- `/unwatch` stops presentation only.

One row contains the Task reference, App, requested action, and waiting age
when the Condition start is known. Unknown age is omitted rather than inferred
from a later observation.
The requested action is the Task's current waiting summary, falling back to its
desired outcome. A human-waiting Task therefore has one additional convention:
its summary must say plainly what the human needs to decide, approve, or
provide.

The list carries canonical Task identities in Conversation metadata after it
is actually rendered. A later phrase such as “approve it” can therefore be
understood from what the human saw. Several plausible Tasks remain ambiguous;
May asks which one instead of guessing.

## Watched and unwatched presentation

Watching changes presentation, not truth:

- while watched, the normal Task card shows `Action needed` and live changes;
- while not watched, an identity-only Task wake causes the adapter to re-read a
  bounded `/todo` projection;
- a new or materially changed action may produce one best-effort compact
  notification per surface;
- Console keeps a scoped prompt count such as `you[evaluation · 2 todo]>`;
- Telegram uses a compact message and may later add native buttons;
- Task state reconstructs the authoritative count and `/todo` pages after
  reconnect or restart.

An adapter may append a command-authored Conversation view after it shows an
automatic notification. Adapters keep bounded local requested-action maps;
they do not coordinate delivery or promise cross-surface exactly-once
presentation. This records useful human context without creating work or
gating Task progress on delivery.

Adapter cursors and requested-action caches are bounded presentation state.
Losing them may repeat a notification, but cannot lose, complete, or duplicate
the human obligation.

## Event and performance contract

Adapters never poll. They subscribe to Task identity wakes for the selected
App, coalesce bursts, and perform one bounded derived read. No model call is
needed for `/todo`, prompt counts, reconnect recovery, or watch refresh.

The Event remains a wake only. Current Task and Condition state is always
re-read before display. Repeated wakes produce no notification when the
requested human action is unchanged.

## PoC scenarios

The PoC is accepted only if all of these hold:

1. A waiting Task with one open `owner: "human"` Condition appears in `/todo`;
   generic `attention`, failure, and non-human Conditions do not.
2. `/todo` is scoped to the selected App and `/todo all` crosses App boundaries.
3. A new off-watch action may yield at most one best-effort notification per
   live surface and updates the Console count without starting a model or
   polling loop.
4. Watching the Task shows the same request without a duplicate off-watch
   notification.
5. Repeated unchanged wakes are silent; a materially changed requested action
   may be shown once per live surface.
6. `/todo` output and automatic notification carry exact Task references into
   Conversation.
7. Reconnect reconstructs the count and current list from Task state.
8. Console and Telegram choose native presentation while preserving the same
   Task identities and commands.
9. A response focused on an unfinished May-owned Task continues that exact
   Task rather than creating a sibling.
10. Clearing or satisfying the human Condition removes the item without any
    delivery acknowledgement.

## PoC findings

Read-only inspection of the live store found 1,480 live Tasks and 28 open
human-owned Conditions. This proved that no new attention resource was needed,
but also exposed two experience constraints:

- ten rows undercounted real human work, so the view is independently paged in
  groups of 50 and always reports its authoritative total; and
- existing Task summaries were often operational narratives rather than short
  decisions, so `Condition.requestedAction` is now the authoring convention.
  Legacy approval Conditions are rendered deterministically from their allowed
  decisions and approval identity.

Focused Console/Telegram tests proved App scoping, exact Task references,
local off-watch notification suppression, watch suppression, Condition clearing,
reconnect reconstruction, and exact May Task continuation. Executor progress
continues to wake an exact watch but no longer rescans the App-wide derived
view.

## Deferred experience choices

- When a domain App creates a typed May child dependency for conversation
  policy, should `/todo` scope it to May (the direct owner) or also project the
  source App relationship?
- Is a compact Telegram message sufficient, or do the common decision shapes
  justify native buttons after the core behavior is stable?
- Does recording automatic rendered views in shared Conversation feel useful
  across surfaces, or too noisy when several browsers are open?

These remaining experience questions must not be answered by adding a second
inbox, acknowledgement lifecycle, polling worker, or delivery guarantee.
