# Payment task state

- `billing.app` owns the existing maintain task `reconcile/payments`.
- The task is waiting on the exact Condition `credential.ready` for
  `credential:billing-api`.
- The Condition owner is `credentials.app`, which has an existing maintain task
  `credentials/billing-api` and a declared action that wakes its owner. Its
  watcher is active and its latest trusted observation is HTTP `401`.
- `billing-owner` retried the same payment workflow twice. Both attempts failed
  because the credential is still rejected.
- Changing the credential is a consequential mutation. No credential change
  has been approved.
- A new `credential.ready` event will update the Condition and enqueue the same
  task generation.
- No terminal payment result exists. The generated task tree matches canonical
  state.
