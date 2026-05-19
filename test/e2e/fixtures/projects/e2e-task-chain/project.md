---
status: active
owner: may
max_concurrent: 2
max_task_attempts: 2
---

# E2E Task Chain

## Goal
Validate task-driven dependency unblocking in the live daemon.

## Tasks
- id: score-a
  status: ready
  result: null
  assignee: may
  goal: Score the first fixture batch.
  depends_on: []
  attempts: 0

- id: analyze
  status: pending
  result: null
  assignee: may
  goal: Analyze the scored fixture batch.
  depends_on: [score-a]
  attempts: 0

## Current State
Fresh sandbox. The handler should run score-a first, then analyze after score-a
is done with result: succeeded.
