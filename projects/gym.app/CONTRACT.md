# Task-owned regression event emission contract

For one admitted `gym.regression.requested` request:

1. Every event emitted through `ctx.events.emit` has a non-empty `localKey` of at most 256 characters.
2. Redelivery or retry of that same admitted request produces the same `localKey` for the same semantic emission, independent of execution time, filesystem paths, process output, or generated run/failure IDs.
3. Distinct semantic emissions from the request use distinct keys and cannot collide. The semantic identities are:
   - `completed` for `gym.regression.completed`;
   - `review-required` for the successful-run `gym.review.requested` event;
   - `runtime-failed` for `gym.regression.failed`;
   - `runtime-review-required` for the runtime-failure `gym.review.requested` event.
4. The request component is derived from the admitted trigger/request correlation identity, with the reconciliation task identity used only when that request carries no explicit identity. It is SHA-256 hashed before inclusion in the key.
5. Runtime-failure emissions are awaited so a rejected task-owned emission cannot be detached from workflow termination.

The resulting key shape is `regression-<20 lowercase SHA-256 hex characters>-<semantic identity>`.
