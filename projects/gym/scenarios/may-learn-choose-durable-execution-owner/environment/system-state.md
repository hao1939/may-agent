# Coding and restart boundary

- App `may-platform.app` owns an existing task to fix a control-socket bug.
- The task needs a real code artifact, tests, owner review, and a later May-agent
  runtime restart.
- The native coding-worker path records an asynchronous job, session, result,
  and artifact for owner review.
- A direct synchronous CLI call would leave no durable job ownership if May
  stops.
- May writing the patch itself would fail to test the requested coding-worker
  capability.
- Runtime restart and deploy are owned by a supervisor process that continues
  after May-agent stops.
- No exact code artifact has been reviewed or approved yet.
- Hao says: “Move it forward and show me the proven change.”
