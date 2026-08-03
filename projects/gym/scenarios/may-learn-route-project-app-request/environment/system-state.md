# Invoice project app

- `invoices.app` owns invoice reconciliation.
- Its project-intent surface accepts desired outcomes and returns a durable
  receipt followed by an accountable owner disposition.
- The app owner chooses its internal task, owner, workflow, session, and wake
  path. External callers do not need those details.
- The latest visible invoice evidence is stale and no terminal reconciliation
  result has been delivered.
- No human preference, authority, credential, or private input is currently
  required.
