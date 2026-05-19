---
status: active
owner: may
max_concurrent: 2
max_task_attempts: 2
---

# E2E Task Judgment

## Goal
Validate that repeated direct task attempts route to owner judgment.

## Tasks
- id: stuck-task
  status: ready
  result: null
  assignee: may
  goal: This task has already used its direct attempts.
  depends_on: []
  attempts: 2

## Current State
Fresh sandbox. The handler should not dispatch stuck-task directly; it should
run the owner judgment workflow.
