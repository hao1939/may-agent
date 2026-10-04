# Semantic finding-delivery dedupe-key drift repair — 2026-08-21

## Failure reproduced

Two materially equivalent Gym findings created separate owner deliveries because their producer-supplied keys differed:

- Session `s_1787349848905_805`: `gym-implementer-missing-artifact-directory-dispatch`
- Session `s_1787349957833_811`: `gym-implementer-missing-writable-artifact-directory`

The findings described the same actionable identity: Gym dispatched `gym-implementer` without the one writable artifact/candidate directory required by its contract. Existing receipt files confirmed that both concern/none variants were delivered independently.

## Implementation

`agents/evaluator/workflows/lib/finding-delivery.ts` now resolves a semantic delivery family before deciding whether to create a receipt or owner delivery:

1. The existing exact `targetAppId + dedupeKey` receipt remains the direct and backward-compatible lookup.
2. When no exact-key receipt exists, version-1 receipts for the same target App are compared using normalized producer-key tokens and material summary/message tokens.
3. A receipt is reused when material similarity meets the established threshold, or when strong producer-key similarity and bounded material overlap jointly identify the same family.
4. Matching a drifted key requires the same severity and requested human action before owner or human delivery is suppressed.
5. Material fingerprints no longer include the producer-supplied key, so producer wording is not treated as finding substance.
6. A changed severity, human action, or materially different instruction remains a new variant and is delivered. Artifact and verification evidence remains recorded on that variant.

The persisted receipt remains `version: 1`; existing receipt fields are unchanged and the reader continues to accept existing version-1 records. No migration is required.

## Regression evidence

`agents/evaluator/workflows/evaluator-aftermath.test.ts` uses the exact Gym sessions and both observed dedupe keys. It verifies:

- The first finding emits one `project.owner.requested` event and no human message.
- The materially equivalent second finding emits neither duplicate owner work nor a human message, despite its different key.
- Both keys resolve to one receipt directory entry and one semantic delivery family.
- A materially changed urgent/approve variant emits a new owner request and human-decision request.
- The changed delivery preserves `artifact:reports/gym-approval-routing.md` and `verification:bun test condition-matcher.test.ts`.
- An exact repeat of that changed actionable variant emits neither owner nor human events.
- Delivery receipts still do not claim issue resolution.

## Verification

Pre-change focused baseline:

```text
bun test agents/evaluator/workflows/lib/task-emission.test.ts agents/evaluator/workflows/evaluator-aftermath.test.ts --timeout 30000
20 pass, 0 fail, 67 expect() calls
```

Post-change focused verification:

```text
bun test agents/evaluator/workflows/lib/task-emission.test.ts agents/evaluator/workflows/evaluator-aftermath.test.ts --timeout 30000
20 pass, 0 fail, 67 expect() calls
```

Additional verification:

```text
bun run typecheck
# exit 0

bun x prettier --check agents/evaluator/workflows/lib/finding-delivery.ts agents/evaluator/workflows/evaluator-aftermath.test.ts
# All matched files use Prettier code style

bun run test
# 80 pass, 0 fail, 289 expect() calls
```
