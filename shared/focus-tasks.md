# Focus Tasks

Active improvement tasks tracked by the system. The `focus-task-tracker` handler
checks these every hour, verifies progress via the signal, and escalates if stuck.

## Format

Each task has: ID, description, owner (agent), signal (how to check progress),
status, created date, and check history. Tasks move through:
`pending` → `in-progress` → `done` | `escalated`

---

## Active Tasks

### F4: Ralph Loop — Explore-to-Implement Pipeline
- **Owner:** bob
- **Status:** in-progress
- **Created:** 2026-03-22
- **Signal:** Design doc exists at agents/shared/ralph-loop-design.md with concrete adaptation plan for our system
- **Escalate after:** 3 failed checks
- **Checks:**

---

## Completed Tasks

### F1: Lean Heartbeat Messages ✅
- **Completed:** 2026-03-22 (s_1772902537648_0, 1m24s)
- **Result:** All 7 heartbeat.md files rewritten to 4-5 line checklists. Zero prose.

### F2: Pattern Recognition Pipeline ✅
- **Completed:** 2026-03-22 (s_1772902546390_1, 1m46s)
- **Result:** Created `safe-edit.md` workflow proposal. Identified blind-overwrite-after-truncation pattern.

### F3: Score-Reactive Coaching Trigger ✅
- **Completed:** 2026-03-22 (s_1772902563880_3, 4m50s)
- **Result:** Found bug — auto-eval path in may.ts lacked coaching trigger. Fixed: both may.ts and cron handler now write to coach's todo + triggerNow on needs_improvement. "No Chores" boundary already existed as P45.
