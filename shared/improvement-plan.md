# System Improvement Plan

**Owner:** May (daily review) + Bob (philosophy alignment)
**Created:** 2026-03-04
**Review cycle:** Daily — May picks the top TODO, works on it, updates status.

## How This Works

1. May reads this file at the start of each daily review
2. Picks the highest-priority item with status `TODO` (or continues `IN_PROGRESS`)
3. Delegates work to the appropriate agent
4. Updates the item's status and log
5. Reports summary to the user

Statuses: `TODO` | `IN_PROGRESS` | `DONE` | `BLOCKED` | `SKIPPED`

---

## P0 — Close the Loop

### P0.1: Schedule Bob via crontab
- **Status:** TODO
- **What:** Add crontab entries to trigger Bob's meta-loop every 4 hours and daily tasks
- **Who:** Ops task — document in docs/usage.md, provide ready-to-paste crontab lines
- **Acceptance:** docs/usage.md has a "Scheduling" section with crontab examples
- **Log:**

### P0.2: Auto-evaluate after task completion
- **Status:** TODO
- **What:** When a child session of May completes, auto-trigger evaluator on the task tree
- **Who:** Coder implements in run/may.ts onSessionComplete callback
- **Files:** run/may.ts, src/evaluator.ts
- **Acceptance:** After any coder/qa session completes under May, an evaluation JSON appears in .state/evaluations/
- **Log:**

## P1 — Data Pipeline

### P1.1: Evaluator lessons → agent knowledge pipeline
- **Status:** TODO
- **What:** After evaluation, parse [agent_name] lessons and append to agents/<agent>/knowledge/lessons.md with dedup
- **Who:** Optimizer implements — extend evaluateTask() or add post-evaluation hook
- **Depends on:** P0.2
- **Acceptance:** After evaluation runs, new lessons appear in the correct agent's lessons.md (no duplicates)
- **Log:**

### P1.2: Optimizer bounded analysis
- **Status:** TODO
- **What:** Update optimizer's domain.md: first pass reads only last 10 evaluations, cap transcript reads at 5
- **Who:** Optimizer updates its own domain.md
- **Acceptance:** Optimizer sessions no longer overflow on analysis phase
- **Log:**

### P1.3: Lighter meta-loop for Bob
- **Status:** TODO
- **What:** Split Bob's meta-loop into atomic tasks in periodic-tasks.md (evaluate, analyze, optimize, philosophy-check as separate triggers)
- **Who:** Bob updates periodic-tasks.md
- **Acceptance:** Each periodic task completes in <15 turns
- **Log:**

## P2 — Agent Effectiveness

### P2.1: May escalation to Master
- **Status:** TODO
- **What:** Add concrete escalation triggers: coder fails twice → Master; task says "debug"/"complex refactor" → consider Master; coder hits turn limit → escalate with partial progress
- **Who:** Optimizer updates May's domain.md
- **Acceptance:** May's domain.md has explicit Master escalation rules
- **Log:**

### P2.2: Coder bounded reads
- **Status:** TODO
- **What:** Add session read budget tracking — warn at 80%, structural guard against context overflow on bulk reads
- **Who:** Coder implements in src/tools.ts (extend TruncationTracker or new mechanism)
- **Acceptance:** Coder sessions doing bulk reads get warnings before overflow; tsc + tests pass
- **Log:**

### P2.3: Evaluator structured output
- **Status:** TODO
- **What:** Parse evaluator JSON output in evaluateTask(), retry once if malformed
- **Who:** Coder implements in src/evaluator.ts
- **Acceptance:** evaluateTask() returns parsed JSON reliably; test coverage added
- **Log:**

### P2.4: test-and-fix workflow
- **Status:** TODO
- **What:** New workflow: run tests → if fail → coder fixes → re-test → done or escalate
- **Who:** Coder implements in agents/may/workflows/test-and-fix.ts
- **Acceptance:** workflow.list() shows test-and-fix; tests pass
- **Log:**

### P2.5: QA severity calibration
- **Status:** TODO
- **What:** Promote severity examples from QA lessons.md to domain.md; add May rule "MINOR-only = PASS"
- **Who:** Optimizer updates QA domain.md and May domain.md
- **Acceptance:** QA domain.md has concrete severity examples section
- **Log:**

## P3 — Infrastructure

### P3.1: Agent config hot-update
- **Status:** TODO
- **What:** Extend reloadAgents() to detect agent.json changes and re-register (only when no active sessions)
- **Who:** Coder implements in run/agent-loader.ts
- **Acceptance:** Changing agent.json + running reload picks up changes; tests pass
- **Log:**

### P3.2: Metrics dashboard
- **Status:** TODO
- **What:** Aggregation script/command that summarizes evaluation data (per-agent scores, top issues, trends)
- **Who:** Coder implements (CLI script or health-check extension)
- **Depends on:** P0.2 (needs sufficient evaluation data)
- **Acceptance:** Running the command produces a readable agent performance summary
- **Log:**
