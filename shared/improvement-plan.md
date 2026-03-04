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
- **Status:** DONE
- **What:** Add crontab entries to trigger Bob's meta-loop every 4 hours and daily tasks
- **Who:** Ops task — document in docs/usage.md, provide ready-to-paste crontab lines
- **Acceptance:** docs/usage.md has a "Scheduling" section with crontab examples
- **Log:**
  - 2026-03-04: Added Scheduling section to docs/usage.md with ready-to-paste crontab entries for May daily review + Bob meta-loop/philosophy/consolidation/health. run/cron-task.sh already existed.

### P0.2: Auto-evaluate after task completion
- **Status:** DONE
- **What:** When a child session of May completes, auto-trigger evaluator on the task tree
- **Who:** Coder implements in run/may.ts onSessionComplete callback
- **Files:** run/may.ts, src/evaluator.ts
- **Acceptance:** After any coder/qa session completes under May, an evaluation JSON appears in .state/evaluations/
- **Log:**
  - 2026-03-04: Added auto-evaluation in run/may.ts onSessionComplete. When child sessions of May complete, evaluateTask() runs after 3s debounce. Saves scores to .state/evaluations/ and appends lessons to agent knowledge files. Committed as 498081a.

## P1 — Data Pipeline

### P1.1: Evaluator lessons → agent knowledge pipeline
- **Status:** DONE
- **What:** After evaluation, parse [agent_name] lessons and append to agents/<agent>/knowledge/lessons.md with dedup
- **Who:** Optimizer implements — extend evaluateTask() or add post-evaluation hook
- **Depends on:** P0.2
- **Acceptance:** After evaluation runs, new lessons appear in the correct agent's lessons.md (no duplicates)
- **Log:**
  - 2026-03-04: Already implemented inside evaluateTask() in src/evaluator.ts — it parses [agent_name] lessons from evaluator output and appends to agents/<agent>/knowledge/lessons.md with timestamps. No additional work needed.

### P1.2: Optimizer bounded analysis
- **Status:** DONE
- **What:** Update optimizer's domain.md: first pass reads only last 10 evaluations, cap transcript reads at 5
- **Who:** Optimizer updates its own domain.md
- **Acceptance:** Optimizer sessions no longer overflow on analysis phase
- **Log:**
  - 2026-03-04: Updated optimizer's domain.md "Analyze" section with bounded analysis rules: max 10 recent evaluations, max 5 transcript reads, head -200 on large files.

### P1.3: Lighter meta-loop for Bob
- **Status:** DONE
- **What:** Split Bob's meta-loop into atomic tasks in periodic-tasks.md (evaluate, analyze, optimize, philosophy-check as separate triggers)
- **Who:** Bob updates periodic-tasks.md
- **Acceptance:** Each periodic task completes in <15 turns
- **Log:**
  - 2026-03-04: Rewrote bob/periodic-tasks.md — split monolithic meta-loop into 5 atomic tasks (evaluate, analyze+brief, philosophy check, lesson consolidation, health check). Each completable in <15 turns.

## P2 — Agent Effectiveness

### P2.1: May escalation to Master
- **Status:** DONE
- **What:** Add concrete escalation triggers: coder fails twice → Master; task says "debug"/"complex refactor" → consider Master; coder hits turn limit → escalate with partial progress
- **Who:** Optimizer updates May's domain.md
- **Acceptance:** May's domain.md has explicit Master escalation rules
- **Log:**
  - 2026-03-04: Updated May's domain.md with concrete Master escalation triggers (coder fails twice, turn limit hit, complex refactor). Added "do NOT start with Master" guard.

### P2.2: Coder bounded reads
- **Status:** DONE
- **What:** Add session read budget tracking — warn at 80%, structural guard against context overflow on bulk reads
- **Who:** Coder implements in src/tools.ts (extend TruncationTracker or new mechanism)
- **Acceptance:** Coder sessions doing bulk reads get warnings before overflow; tsc + tests pass
- **Log:**
  - 2026-03-04: Added session read budget to TruncationTracker in src/tools.ts. Tracks cumulative bytes, warns at 500KB. 7 new tests. Committed as e9f6b0a.

### P2.3: Evaluator structured output
- **Status:** DONE
- **What:** Parse evaluator JSON output in evaluateTask(), retry once if malformed
- **Who:** Coder implements in src/evaluator.ts
- **Acceptance:** evaluateTask() returns parsed JSON reliably; test coverage added
- **Log:**
  - 2026-03-04: Added retry logic in evaluateTask() — if evaluator produces no JSON agent scores, retries once with focused prompt. Committed as 60d9049.

### P2.4: test-and-fix workflow
- **Status:** DONE
- **What:** New workflow: run tests → if fail → coder fixes → re-test → done or escalate
- **Who:** Coder implements in agents/may/workflows/test-and-fix.ts
- **Acceptance:** workflow.list() shows test-and-fix; tests pass
- **Log:**
  - 2026-03-04: Created agents/may/workflows/test-and-fix.ts. Pattern: run tests → if fail → coder fixes → re-test → done or escalate. One retry.

### P2.5: QA severity calibration
- **Status:** DONE
- **What:** Promote severity examples from QA lessons.md to domain.md; add May rule "MINOR-only = PASS"
- **Who:** Optimizer updates QA domain.md and May domain.md
- **Acceptance:** QA domain.md has concrete severity examples section
- **Log:**
  - 2026-03-04: Added severity calibration section to QA's domain.md with CRITICAL/IMPORTANT/MINOR examples and false positive list. Added "MINOR-only = PASS" rule to May's domain.md.

## P3 — Infrastructure

### P3.1: Agent config hot-update
- **Status:** DONE
- **What:** Extend reloadAgents() to detect agent.json changes and re-register (only when no active sessions)
- **Who:** Coder implements in run/agent-loader.ts
- **Acceptance:** Changing agent.json + running reload picks up changes; tests pass
- **Log:**
  - 2026-03-04: Already implemented in commit 0283a05 — reloadAgents() re-registers existing agents. manager.register() uses Map.set() which overwrites. Active sessions keep old config; new sessions use updated definition.

### P3.2: Metrics dashboard
- **Status:** DONE
- **What:** Aggregation script/command that summarizes evaluation data (per-agent scores, top issues, trends)
- **Who:** Coder implements (CLI script or health-check extension)
- **Depends on:** P0.2 (needs sufficient evaluation data)
- **Acceptance:** Running the command produces a readable agent performance summary
- **Log:**
  - 2026-03-04: Created run/metrics.ts — CLI dashboard aggregating evaluation data. Per-agent scores, waste ratios, verdicts, top issues, top lessons. Usage: npx tsx run/metrics.ts --days 30. Committed as d0fae11.
