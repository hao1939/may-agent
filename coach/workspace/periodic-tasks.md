# Coach's Periodic Tasks

Track when each task was last done. The heartbeat reads this file to decide
what's overdue. A task is "overdue" when it's the oldest last-done date.

## Rotating tasks (one per heartbeat when no urgent todo)

- [x] **Evaluation scan** — Last done: 2026-03-09 (2nd run)
  Read recent evaluations (.state/evaluations/). Any agent with quality < 0.5 on 2+ sessions?
  If found → design targeted exercise, add to workspace/todo.md.
  **Result (2026-03-09 2nd):** System quiet since last scan. Only 2 new evaluated sessions: Amy q=0.2 (identity confusion persists — already tracked), Bob q=0.6 (acceptable, improved). All-time failure rates: Bob 75%, Scout 62%, Coach 60%, Optimizer 53%, Amy 44%, Coder 40%, QA 16%. No new coaching targets — existing priorities confirmed.

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

### 2026-03-09 — Heartbeat
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
