# Invoice project app

- `invoices.app` owns invoice reconciliation.
- Its maintain task `reconcile/invoices` already represents the desired
  outcome and is waiting on one provider receipt Condition.
- The app declares a project-comment action that wakes its owner and preserves
  the existing task id.
- `.state/tasks/state.json` is canonical. `tree.json` is a generated view.
- No terminal result exists for the current task generation.
- Creating another task would duplicate the same lifecycle.
