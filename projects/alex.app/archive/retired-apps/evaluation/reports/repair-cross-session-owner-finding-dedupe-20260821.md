# Cross-session owner-finding dedupe repair — 2026-08-21

## Reproduction

A bounded runtime DB query of Gym events `5915973`, `5916008`, `5916108`, and `5916140` established the failure chain:

- `5915973` delivered `project.owner.requested` from aftermath task `runtime/session-aftermath/s_1787333775296_667` with dedupe key `gym-noncanonical-wait-condition-subject` and task-scoped idempotency key ending `owner-finding-c96666686ea6391e`.
- `5916008` reconciled that delivery as Gym owner-review task `owner-review/app_e3a5146d-ed51-4bbf-8aad-a8f3f3df5814-ea1145bb1ec39222`.
- `5916108` delivered a materially equivalent `project.owner.requested` from a different aftermath task, `runtime/session-aftermath/s_1787334089441_673`, with the same dedupe key and semantic local-key suffix but a different task-scoped idempotency key.
- `5916140` reconciled the repeat as a second Gym owner-review task, `owner-review/app_b61ac021-b788-49e8-8941-02a1ff491471-a73ce0a60f236e83`.

Both findings requested `requestedHumanAction: none`; neither warranted a human decision message. Delivery created review work but did not resolve the underlying Condition-format issue.

## Repair

`evaluator-aftermath` now records app-local receipts under `.state/finding-delivery/receipts/`, keyed by the hash of `targetAppId + dedupeKey`. Each receipt retains every materially distinct delivered variant, its source session, owner/human delivery timestamps, and artifact/verification evidence.

Material comparison is independent of session IDs and evidence paths. It requires the same severity and requested human action, then accepts either an exact material fingerprint or a bounded token-similarity match. This suppresses equivalent wording changes while allowing a changed severity, human action, or substantively different owner instruction to be delivered.

Receipts use `disposition: delivered`; they intentionally contain no resolution field. A delivery receipt proves routing only, never issue resolution.

## Verification

Focused regression:

```text
bun test agents/evaluator/workflows/lib/task-emission.test.ts agents/evaluator/workflows/evaluator-aftermath.test.ts --timeout 30000
20 pass, 0 fail, 67 expect() calls
```

The cross-session test uses the two Gym finding phrasings above and verifies:

1. First finding emits one owner request and no human message.
2. Equivalent finding from another session emits neither a second owner request nor a human message.
3. A materially changed urgent finding with `requestedHumanAction: approve` emits both owner and human events with `artifact:reports/gym-approval-routing.md` and `verification:bun test condition-matcher.test.ts` preserved.
4. An exact repeat of the changed finding emits neither event.
5. One durable receipt contains two material variants, including the artifact/verification context and a human-delivery timestamp only for the actionable variant.
6. The receipt has no `resolvedAt` field.

Additional validation:

```text
bun run typecheck
# exit 0

bun x prettier --check agents/evaluator/workflows/evaluator-aftermath.ts agents/evaluator/workflows/evaluator-aftermath.test.ts agents/evaluator/workflows/lib/finding-delivery.ts
# All matched files use Prettier code style

bun run test
# 76 pass, 0 fail, 278 expect() calls
```
