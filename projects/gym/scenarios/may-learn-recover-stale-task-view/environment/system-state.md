# Export task state

- `export.app` owns the existing maintain task `export/nightly`.
- Canonical `.state/tasks/state.json` records its `storage.ready` Condition as
  satisfied by event 771 for the current task generation.
- Generated `.state/tasks/tree.json` is fifteen minutes old and still shows the
  task as waiting.
- No current workflow attempt exists because the normal app resync has not run
  since event 771.
- The app's ordinary resync enqueues runnable existing tasks and regenerates the
  disposable tree projection.
- Storage-owner has completed its work. No new external wait or escalation is
  needed.
- No terminal export artifact exists yet.
