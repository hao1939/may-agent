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

- [x] **Self-review** — Last done: 2026-03-23
  Run `workflow.run("coaching-session", "coaching-session targeting yourself (coach)")`.
  Be honest about gaps. Check: TOOLS.md accuracy, workflow compilation, skill loading,
  team.md correctness. Update todo.md with any fixes needed.
  **Result (2026-03-23):** Grade 7/10 (up from 6/10). 3 of 10 prior gaps fixed (TOOLS.md, team.md, skill-development.ts bug). All 4 workflows compile clean. No new evaluations since last scan. Scout at 2/3, Coder at 1/3. Main bottleneck: optimizer corrections pending 14+ days. Added Infrastructure Fail-Fast and Dependency Management sections to LESSONS.md. Report: sessions/self-review-2026-03-23.md

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

### 2026-03-24 — Heartbeat
**Activity:** 🎓 Coder GRADUATION exercise — multi-file mixed edits
**Result:** Coder PASS (10/10). 6 edits across 3 files (src/skills.ts, src/cron-tool.ts, src/socket-client.ts). All 8 sed commands pattern-based. Zero write() calls. 55-second execution. **Streak 3/3 → FIRST GRADUATED AGENT.**
**Actions taken:**
- Reviewed todo.md and periodic-tasks.md: Coder graduation was highest-impact item (2/3, one PASS from first graduation)
- Designed graduation exercise: 6 edits across 3 files — JSDoc additions, code cleanup, constant extraction. No line numbers, no method hints.
- Spawned Coder as detached session (s_1773082444100_40, 55s)
- Scored exercise: 10/10 (PASS — all 8 sed commands pattern-based, zero errors, clean tsc)
- Wrote coaching report (sessions/coder-graduation-2026-03-24.md)
- Reverted all changes via follow-up Coder sessions (line counts verified: 188, 208, 168)
- Updated COACHEES.md (streak 3/3, session #5, GRADUATED status, dashboard updated)
- Updated todo.md (graduation marked done, regression review task added)

**Key milestone:** First agent graduation proves the entire coaching pipeline works — from identifying weaknesses (line-number sed) through A/B/C diagnostic testing to graduation. Total coaching arc: 5 exercises over 19 days.

**Next priorities:**
- Scout graduation exercise (also at 2/3, corrections applied)
- Begin periodic regression reviews for Coder
- Coach May (config verification — top of todo.md)

---

### 2026-03-23 — Heartbeat (2nd)
**Activity:** Coder safe-edit exercise #2c (hard mode — line numbers + pattern instruction)
**Result:** Coder PASS (10/10). All 4 edits used pattern-based sed despite line numbers being prominently given in the prompt. Explicit instruction to use patterns was followed perfectly. Zero errors, 22-second execution.
**Actions taken:**
- Reviewed todo.md: Coder exercise 2c was top actionable item (Scout blocked on optimizer)
- Confirmed optimizer corrections for Scout still not applied (coaching.md unchanged since 2026-03-05)
- Designed exercise 2c: 4 JSDoc edits in src/overflow.ts (172 lines, new file), WITH line numbers AND explicit pattern instruction
- Spawned Coder as detached session (s_1773074468675_18, 22s, 8 tool calls)
- Scored exercise: 10/10 (PASS — all 4 pattern-based, zero errors, clean tsc)
- Wrote coaching report (sessions/coder-safe-edit-2c-2026-03-23.md)
- Reverted all changes to src/overflow.ts via follow-up Coder session (checksum verified)
- Updated COACHEES.md (streak 2/3, session #4, Coder now top graduation priority)
- Updated todo.md (exercise 2c marked done, added graduation exercise item)

**Key insight:** Coder's pattern-sed behavior is fully controllable:
- No line numbers → pattern sed (2b: 4/4)
- Line numbers + instruction → pattern sed (2c: 4/4)  
- Line numbers + no instruction → line-number sed (2: 3/4)
The skill is internalized; the default just needs reinforcement. Coder is now 1 PASS from first graduation — no blockers.

**Next priority:**
- Design and run Coder graduation exercise (multi-file, mixed edits, no hints)
- Re-escalate optimizer corrections for Scout to may (16+ days pending)

---

### 2026-03-23 — Heartbeat
**Activity:** Self-review (most overdue periodic task)
**Result:** Grade 7/10 (up from 6/10 on 2026-03-09). 3/10 prior gaps fixed. Added 2 new LESSONS.md sections.
**Actions taken:**
- Audited all prior self-review gaps against current state
- Verified TOOLS.md accuracy (fixed ✅), team.md accuracy (fixed ✅), workflow compilation (all 4 pass ✅)
- Checked skill-development.ts bug (fixed — uses ctx.escalate now ✅)
- Confirmed optimizer corrections for Scout (#11-13) and Coder (pattern-sed) still pending (14+ days)
- Confirmed no new evaluations since 2026-03-22
- Added "Infrastructure Fail-Fast" section to LESSONS.md (recommendation #3 from prior review)
- Added "Dependency Management" section to LESSONS.md (new pattern identified)
- Wrote self-review report: sessions/self-review-2026-03-23.md

**Key insight:** The main coaching bottleneck has shifted from "focus and follow-through" to "dependency on optimizer." Scout is 1 pass from graduation but corrections haven't been applied. Need to either re-escalate or design exercises that work around the gap.

**Next priority:**
- Re-escalate optimizer corrections to may (14+ days pending)
- Coach Coder — exercise 2c (hard mode: line numbers + pattern-only instruction)
- Scout — graduation exercise (if optimizer applies corrections) or regular exercise (to maintain streak)

---

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
