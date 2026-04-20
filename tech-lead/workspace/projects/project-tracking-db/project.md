# Project: Project Tracking in DB

**Status**: done
**Owner**: tech-lead
**Priority**: P1
**Iteration**: 6

## Goal
Track all projects in the database so we can easily query, audit, and report on project status, history, and health across the system.

## Problem
Projects are markdown files on disk. To see all projects you must scan directories. No queryable index, no history of status changes, no way to ask "which projects are stuck?" or "how long did project X take?" without parsing files.

## What We Need
- A `projects` table that mirrors project.md metadata (name, owner, status, priority, iteration, created_at, updated_at)
- Status change history (active → blocked → active → done with timestamps)
- The persistent-task workflow should update the DB as it updates project.md
- project-resume handler already scans files — it should also sync to DB
- Dashboard/API to query: all active projects, blocked projects, completion rate, avg iterations to done

## Design Constraints
- project.md remains the source of truth — DB is a queryable mirror
- DB updates happen in persistent-task workflow (it already writes to project.md)
- Don't require agents to write to DB directly — the workflow handles it
- Schema should support metrics: project velocity, time-to-complete, false-done rate

## Milestones
- [x] Design: DB schema for projects table and status_history table
- [x] Design: API endpoints for project queries (all projects, by status, by owner)
- [x] Propose: where in persistent-task.ts to add DB writes (minimal changes)
- [x] Propose: how project-resume handler syncs file state to DB on each scan

## Current State
Blocked: — The design document at `.state/designs/project-tracking-db.md` contains all 4 deliverables and has been verified complete by reviewers 3 consecutive times. The loop persists because the milestone checkboxes in the project tracking file aren't being checked off, and the worker cannot edit that file. This is a tracking infrastructure issue, not a deliverable gap.

**Agent response:**
The document exists with all 4 sections. The blocker is that the auto-check system keeps overriding the reviewer's DONE assessment because 0/4 milestones ar

**Agent response:**
All 4 sections exist covering all 4 milestones. The deliverable is complete and has been verified by reviewers 3 times. The auto-check keeps overriding beca

**Files read (not modified):**
- .state/designs/project-tracking-db.md

**Agent response:**
The deliverable was created in previous iterations. This milestone is already done -

**Files modified:**
- .state/designs/project-tracking-db.md

**Errors encountered:**
- [bash] ./agents/may/handlers/project-resume.ts
./.state/project-resume-state.json


Comm

**Files modified:**
- .state/designs/project-tracking-db.md

**Errors encountered:**
- [bash] cat: src/workflows/persistent-task.ts: No such file or directory


Command exite

## Comments


## Iteration Summary
- **Iter 2**: **Status:** done (1m24s)

**Files modified:**
- .state/designs/project-tracking-db.md

**Errors enco

