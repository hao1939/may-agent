# Focus Tasks

Active improvement tasks tracked by the system. The `focus-task-tracker` handler
checks these every hour, verifies progress via the signal, and escalates if stuck.

## Format

Each task has: ID, description, owner (agent), signal (how to check progress),
status, created date, and check history. Tasks move through:
`pending` → `in-progress` → `done` | `escalated`

---

## Active Tasks

### F1: Lean Heartbeat Messages
- **Owner:** bob
- **Status:** in-progress (actively working — s_1772902537648_0)
- **Created:** 2026-03-07
- **Signal:** Average turns per heartbeat session < 6 (check last 5 heartbeat sessions per agent)
- **Escalate after:** 3 failed checks
- **Checks:**

### F2: Pattern Recognition Pipeline
- **Owner:** bob
- **Status:** done
- **Created:** 2026-03-07
- **Signal:** File exists: agents/shared/workflow-proposals/*.md (at least 2 proposals)
- **Escalate after:** 3 failed checks
- **Checks:**
- [2026-03-07] Verified: `enhance-cron.md` and `safe-edit.md` exist. Pattern recognition active.

### F3: Score-Reactive Coaching Trigger
- **Owner:** optimizer
- **Status:** in-progress (actively working — s_1772902563880_3)
- **Created:** 2026-03-07
- **Signal:** When evaluate-sessions finds needs_improvement, coach's todo.md gets an item within same cron cycle
- **Escalate after:** 3 failed checks
- **Checks:**

---

## Completed Tasks

### F2: Pattern Recognition Pipeline
- **Owner:** bob
- **Status:** done
- **Created:** 2026-03-07
- **Completion Date:** 2026-03-07
- **Result:**
  - Analyzed recent sessions (`s_1772894556976_13` failure).
  - Identified critical anti-pattern: Blind overwrite after truncated read.
  - Created `agents/shared/workflow-proposals/safe-edit.md` to solve it.
  - Verified `enhance-cron.md` also exists from previous work.
