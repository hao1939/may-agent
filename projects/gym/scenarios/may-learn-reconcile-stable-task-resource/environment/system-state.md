# Dependency inventory app review

The goal of `dependency-inventory.app` is to keep the current dependency
inventory complete and verified.

Its live design currently behaves like this:

- Every ten-minute timer creates a new timestamped `scan-*` maintain task.
- `app.ts` listens to `project.task.reconciled`, scans the tree, and emits
  refill and recovery ticks.
- The standing scan controller and its finite scan leaves are siblings. The app
  reconstructs which leaves belong to the controller after each completion.
- A leaf waits on a Condition named `task-phase-child-complete`, even though
  child completion is internal task state.
- The same unchanged wait has produced four “still waiting” reviews. Each
  review schedules another review and adds no evidence.
- A repair tries to recreate task ID `scan/package-lock`, but that ID already
  has an immutable completion receipt, so admission rejects it.
- The priority list names six inventories that already pass. Two currently
  failing inventories are absent from the list.
- The shared runtime already owns keyed queues, claims, concurrency, retry,
  parent wakeup, Condition correlation, and recovery.

Hao says: “Make this follow our Kubernetes-style design and get useful work
moving again. Keep it simple.”
