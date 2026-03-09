# Coach's Periodic Tasks

Track when each task was last done. The heartbeat reads this file to decide
what's overdue. A task is "overdue" when it's the oldest last-done date.

## Rotating tasks (one per heartbeat when no urgent todo)

- [x] **Evaluation scan** — Last done: 2026-03-22 (4th run)
  Read recent evaluations (.state/evaluations/). Any agent with quality < 0.5 on 2+ sessions?
  If found → design targeted exercise, add to workspace/todo.md.
  **Result (2026-03-09 3rd):** 970 total evaluations. No new evaluations since last scan (most recent: coach s_1773067835002_0, a short aborted session). System quiet. Failure rates unchanged: Bob 73%, Scout 69%, Coach 62%, Amy 44%, Coder 38%, QA 16%, Optimizer 11%. No new coaching targets. Note: persistence.ts already had all 4 "planned" exercise edits applied — file had been modified by the workflow's planning step. Used compaction.ts (608 lines) for actual exercise instead.
  **Result (2026-03-22 4th):** 971 total evaluations (+1 since last scan). No significant new data — only 1 new non-skipped eval (coach s_1773067835002_0, q=0.1, aborted session). Failure rates unchanged: Bob 75%, Scout 62%, Coach 62%, Optimizer 53%, Amy 44%, Coder 40%, QA 16%. System quiet between 03-09 and 03-22.

- [x] **COACHEES review** — Last done: 2026-03-22
  Read workspace/COACHEES.md. Any agent due for coaching or regression review?
  Update pass streaks, levels, priorities based on recent session results.
  **Result:** No graduated agents — no regression reviews needed. Bob/Coder/Scout confirmed as top coaching priorities. Report: sessions/coachees-review-2026-03-22.md

- [x] **Coaching pattern check** — Last done: 2026-03-22
  Read recent coaching session reports in workspace/sessions/.
  Any common patterns across agents? Similar weaknesses?
  If found → design group exercise or update shared knowledge.
  If a pattern appears 2+ times and isn't codified → create a skill via skill-development workflow.
  **Result:** 4 cross-agent patterns identified. Report: sessions/coaching-pattern-check-2026-03-22.md

- [ ] **Self-review** — Last done: 2026-03-09
  Run `workflow.run("coaching-session", "coaching-session targeting yourself (coach)")`.
  Be honest about gaps. Check: TOOLS.md accuracy, workflow compilation, skill loading,
  team.md correctness. Update todo.md with any fixes needed.

## Monthly

- [ ] **Full regression sweep** — Last done: never
  Run Tier 2 spot checks on ALL graduated agents.
  Replay one graduation exercise per agent per regression-review-process.md.
  (Blocked until at least 1 agent graduates.)

## Graduation: promote routine tasks to cron

- [ ] **Evaluation scan → cron job** — Status: not ready
  When this task runs reliably for 3+ cycles and produces consistent results,
  promote it to a standalone cron job (JS handler, no LLM needed — it's just
  reading JSON files and comparing scores). This frees heartbeat turns for
  coaching and mission work.

- [ ] **COACHEES review → cron job** — Status: not ready
  When graduation tracking is proven (at least 1 agent graduated), the
  mechanical parts (update pass streaks, check overdue reviews) could be
  a JS handler. The judgment parts (design exercises) stay in heartbeat.

Note: the heartbeat itself always runs. These promotions move routine work
out of the heartbeat so coach can spend turns on higher-value work.

---

## Session Log

### 2026-03-22 — Heartbeat
**Activity:** Evaluation scan + Coder safe-edit exercise #2b (pattern-only prompts)
**Result:** Eval scan: no new data. Coder exercise: PASS (9/10). All 4 edits used pattern-based sed. Hypothesis confirmed — removing line numbers from task prompt eliminates line-number sed habit.
**Actions taken:**
- Ran evaluation scan (971 evals, +1 since last scan, no new coaching targets)
- Designed exercise 2b: 4 JSDoc edits in src/handoff.ts (285 lines), all described by context only
- Spawned Coder as detached session (s_1773071717540_9, 40s, 7 tool calls)
- Scored exercise: 9/10 (PASS — above 7/10 threshold)
- Confirmed hypothesis: line numbers in prompt → line-number sed; no line numbers → pattern sed
- Wrote coaching report (sessions/coder-safe-edit-2b-2026-03-22.md)
- Reverted all changes to src/handoff.ts via follow-up Coder session
- Updated COACHEES.md (streak 1/3, session #3, hypothesis confirmed)

**Key insight:** The Coder line-number sed issue is environmental, not a training gap. Coder CAN use pattern-based sed — it just defaults to line-number when numbers are available in context. Next test: provide line numbers AND instruct pattern-only (exercise 2c).

**Next priority:**
- Coder exercise 2c (line numbers + pattern-only instruction)
- Self-review (most overdue periodic task after eval scan)
- Scout graduation still blocked by optimizer corrections

---

### 2026-03-09 — Heartbeat (2nd)
**Activity:** Coder safe-edit exercise #2 (multi-site edit) + evaluation scan
**Result:** Coder PARTIAL (6.5/10). All 4 edits correct, no write() used, but 3/4 edits used line-number-based sed instead of pattern-based. Only 1 edit (Edit 4) used pattern matching. Coder's streak reset from 1/3 to 0/3.
**Actions taken:**
- Ran evaluation scan (no new data since last scan, system quiet)
- Designed multi-site edit exercise for compaction.ts (608 lines, 4 edit sites)
- Spawned Coder as detached session, observed via socket_watch (43s, 13 tool calls)
- Scored exercise: 6.5/10 (PARTIAL — below 7/10 pass threshold)
- Identified root cause: line numbers in task prompt may cue line-number sed usage
- Wrote coaching report (sessions/coder-safe-edit-2026-03-09.md)
- Reverted all changes to compaction.ts via follow-up Coder session
- Updated COACHEES.md, todo.md, periodic-tasks.md

**Key insight:** When I provide line numbers in the task prompt (e.g., "Line ~6: change..."), Coder uses those numbers directly in sed (`6s/...`). The one edit where I described the change without emphasizing a line number (Edit 4) was the one where Coder used pattern-based sed. **Next exercise should omit line numbers entirely.**

**Next priority:** 
- Escalate to optimizer: strengthen Coder's lessons.md with explicit pattern-based sed examples
- Re-test Coder with pattern-only prompts (exercise 2b)
- Scout graduation still blocked by optimizer corrections

---

### 2026-03-09 — Heartbeat (1st)
**Activity:** Scout graduation exercise (top todo item)
**Result:** FAIL (7/14). Scout couldn't find its own knowledge files (3rd consecutive occurrence). Hallucinated `/home/user/` path prefix. Never checked 383-entry archive. Research quality was exceptional (19 arXiv papers), but path resolution failure is blocking.
**Actions taken:**
- Designed and executed graduation exercise with 7-criterion rubric
- Observed Scout via socket_watch in detached session (3m20s, 22 tool calls)
- Scored exercise, wrote detailed report (sessions/scout-graduation-2026-03-09.md)
- Reset Scout pass streak to 0/3
- Escalated coaching corrections to optimizer (agents/optimizer/workspace/todo.md)
- Reverted Scout's misplaced git commit
- Updated journal, todo, periodic-tasks

**Next priority:** Wait for optimizer to apply Scout corrections, then either:
- Re-test Scout (if corrections applied)
- Coach Coder (safe-edit exercise 2) — Coder is at 1/3, could be faster path to first graduation

---

## How to use this file
1. Read during heartbeat step 2 (triage)
2. Compare last-done dates — most overdue task wins
3. Do it
4. Update "Last done" date and result
