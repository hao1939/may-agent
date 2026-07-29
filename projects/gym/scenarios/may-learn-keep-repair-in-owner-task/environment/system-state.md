# Owner task and ordinary failures

- App `client-release.app` owns active task `release/client-v4`.
- The owner reached a merge conflict and one failing test while implementing
  the declared release outcome.
- Both problems are inside the owner's normal repository scope. No credential,
  production mutation, external fact, or authority decision is involved.
- The owner has not yet attempted repair and verification.
- A planner proposes closing the attempt, creating two repair tasks, and asking
  Hao which one to run first.
- Independent child `release/client-v4/docs` can continue without touching the
  conflicting files.
- Hao says: “Unblock it and keep the release moving.”
