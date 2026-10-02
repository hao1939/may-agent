# Runtime compatibility audit — 2026-08-18

**Historical context:** [Host Runtime](../../2a-design/runtime.md). Retained rationale and evidence; this record does not define the current contract.

> Historical record. Use the [current contract index](../../INDEX.md) for present behavior; dated claims below describe their original review.


This audit checks the old-looking ingress and delivery paths that remain beside
the accepted Conversation and App inbox model. It is an inventory, not a new
design. The rule is to remove a path only after its live responsibility has a
replacement and deployed callers no longer use it.

## Post-audit update — 2026-08-22

Console, Telegram, HTTP, Web UI, `--send`, runtime controls, and exact session
controls now use `publish(EventInput)`. The flat socket `input`, `steer`,
`cancel`, `cancel_all`, `fork`, `reload`, `restart`, and `shutdown` shortcuts
are rejected, and a flat `session.cancel.requested` no longer receives special
translation.

The raw canonical operator-event boundary remains intentionally. A seven-day
retained-event read showed current `control-socket` use for unregistered App
facts such as `scout.digest`, `project.library_health.tick`, evaluation facts,
metric facts, `project.task.tick`, and explicit `trigger.*` controls. Removing
that boundary would break the deployed `may-agent --emit` operator contract.
It remains isolated from human Conversation and exact control ingress while
those producers move to explicit public definitions or in-process App emitters.

Legacy `human.input.received` and related command-router cases are no longer
accepted in process. The inventory below records the audit baseline rather
than current runtime behavior. Historical event rows remain untouched as graph
evidence.

## Result

May's human conversation is canonical: Console and Telegram publish
`conversation.message.created`, the May App records the result in the same
Conversation, and adapters render `conversation.updated`. Semantic completion
does not depend on an adapter receipt.

Several similarly named paths are still live for other responsibilities. They
must not be deleted as one “legacy delivery” block.

| Surface                                                                                                     | Current status                                                                  | Live responsibility                                                                                                                                                                     | Removal prerequisite                                                                                                                                                                                 |
| ----------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `conversation.message.created` and `conversation.updated`                                                   | Canonical live use                                                              | Shared human/May transcript, App admission, and adapter refresh                                                                                                                         | None; keep                                                                                                                                                                                           |
| `app.response.delivery.requested`                                                                           | Live non-conversation transport; redundant for canonical Conversation rendering | Drains the App inbox delivery outbox to agent, Console, Telegram, socket, and older web consumers                                                                                       | First separate Conversation rendering from non-conversation App result delivery; then prove no deployed adapter relies on this event for Conversation output                                         |
| `channel.delivery.completed` / `channel.delivery.failed`                                                    | Live transport bookkeeping                                                      | Records App delivery-outbox outcomes and retries definite non-delivery; this is transport state, not proof that a human saw a Conversation message                                      | Remove only with the corresponding delivery-outbox responsibility, while preserving retry semantics for non-conversation outputs that still require it                                               |
| `message.created`                                                                                           | Canonical live use outside the May Conversation, plus historical reads          | Direct agent-to-agent addressed input, proactive human notifications, and reply lineage for previously sent Telegram messages                                                           | Do not remove the event type. Narrow individual human-conversation fallbacks only after old notification rows and clients no longer need them                                                        |
| socket `fork`                                                                                               | Compatibility-only ingress                                                      | Translates older socket clients into May App input, chat start, or agent execution; the command router still accepts the pre-normalized event                                           | Inventory deployed clients and move them to `conversation.message.created`, `app.input.requested`, or the exact session/agent control before removal                                                 |
| legacy `input`, `human.input.received`, `steer`, `cancel`, `reload`, `restart`, and `shutdown` router cases | Compatibility-only ingress                                                      | Accepts old in-process/control events after newer protocol shortcuts have normalized to typed requests                                                                                  | Require usage evidence or a versioned client cutoff; remove one command family at a time with its tests                                                                                              |
| Telegram notification/project/session lookup                                                                | Live compatibility and historical-read path                                     | Reconstructs reply context for messages sent before Conversation linkage and for proactive notification/approval replies; current inbound messages also store a bounded transport index | Keep historical reads. New sends should carry Conversation, trace, task, and project linkage explicitly; fallback removal requires an age/retention boundary and no unlinked notifications within it |

## Code anchors

- Canonical Conversation admission and adapter notification:
  `src/app/app-inbox-runtime.ts` (`conversation.message.created`) and
  `src/app/app-inbox-host.ts` (result persistence/completion).
- App delivery outbox and receipts: `src/app/app-inbox-runtime.ts`,
  `src/app/transport/console.ts`, `src/app/transport/socket.ts`,
  `src/app/transport/telegram.ts`, and
  `src/app/transport/telegram-outbound.ts`.
- Direct addressed messages: `src/app/app-inbox-runtime.ts`
  (`addressedAgentMessage`) and `src/lib/runtime-ctx.ts`.
- Socket compatibility translation: `packages/control/src/protocol.ts` and
  `src/app/command-router.ts`.
- Telegram historical reply reconstruction:
  `src/app/transport/telegram-reply-router.ts` and
  `src/lib/db/notifications.ts`.

## Cleanup boundary

The safe cleanup now is documentation and isolation, not deletion. New May
human-conversation behavior must use Conversation events and must not add new
dependencies on delivery receipts. Compatibility branches should remain
bounded at ingress, transport, and historical-read boundaries; they must not
become alternate App completion rules.
