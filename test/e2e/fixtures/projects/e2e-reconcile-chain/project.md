---
status: active
owner: may
---

# E2E Reconcile Chain

## Goal
Validate event-driven task unblocking and final owner review.

## Tasks
- id: seed
  status: done
  result: succeeded
  assignee: may
  goal: Seed work already completed.
  depends_on: []
  attempts: 1

- id: followup
  status: pending
  result: null
  assignee: may
  goal: Run after seed succeeds.
  run: workflow:e2e-task-worker-stub
  depends_on: [seed]
  attempts: 0
