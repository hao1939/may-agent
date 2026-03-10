# Coach's Periodic Tasks

Track when each task was last done. The heartbeat reads this file to decide
what's overdue. A task is "overdue" when it's the oldest last-done date.

## Rotating tasks (one per heartbeat when no urgent todo)

- [x] **Evaluation scan** — Last done: 2026-03-25 (5th run)
  Read recent evaluations (.state/evaluations/). Any agent with quality < 0.5 on 2+ sessions?
  If found → design targeted exercise, add to workspace/todo.md.
  **Result (2026-03-09 3rd):** 970 total evaluations. No new evaluations since last scan (most recent: coach s_1773067835002_0, a short aborted session). System quiet. Failure rates unchanged: Bob 73%, Scout 69%, Coach 62%, Amy 44%, Coder 38%, QA 16%, Optimizer 11%. No new coaching targets. Note: persistence.ts already had all 4 "planned" exercise edits applied — file had been modified by the workflow's planning step. Used compaction.ts (608 lines) for actual exercise instead.
  **Result (2026-03-22 4th):** 971 total evaluations (+1 since last scan). No significant new data — only 1 new non-skipped eval (coach s_1773067835002_0, q=0.1, aborted session). Failure rates unchanged: Bob 75%, Scout 62%, Coach 62%, Optimizer 53%, Amy 44%, Coder 40%, QA 16%. System quiet between 03-09 and 03-22.
  **Result (2026-03-25 5th):** 1046 total evaluations (+75 since last scan). 3 new actionable evaluations: Bob s_1773083559086_52 q=0.2 needs_improvement (sed thrashing — coached, PASS 10/10), Optimizer s_1773083423706_50 q=0.85 good (path hallucination, minor), Coach s_1773078712214_8 q=0.45 acceptable (path failures). Bob coaching exercise completed this session.

- [x] **COACHEES review** — Last done: 2026-03-09 (6th heartbeat)
  Read workspace/COACHEES.md. Any agent due for coaching or regression review?
  Update pass streaks, levels, priorities based on recent session results.
  **Result (2026-03-22):** No graduated agents — no regression reviews needed. Bob/Coder/Scout confirmed as top coaching priorities. Report: sessions/coachees-review-2026-03-22.md
  **Result (2026-03-09 prev):** 2 graduated (Coder, Scout), both due for regression review ~2026-04-07. May updated to 2/3 streak. Bob blocked on optimizer corrections.
  **Result (2026-03-09 6th):** May exercise #3 PASS (13.5/15, 90%). **May now at 3/3 → qualifies for graduation exercise.** Bob coaching corrections applied by May (created coaching.md). Infra blocker resolved (buildProjectStructure added by May). Dashboard refreshed: May top priority for graduation. Bob unblocked for exercise #4.

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

### 2026-03-09 — Heartbeat (6th)
**Activity:** COACHEES review + May exercise #3 (multi-step follow-through)
**Result:** May **PASS** (13.5/15, 90%). **Streak: 3/3 → qualifies for graduation exercise.** Two major blockers resolved by May during exercise.
**Actions taken:**
- Reviewed todo.md and periodic-tasks.md: May exercise #3 was top priority (2/3 streak, 1 PASS from graduation)
- Noted infra blocker (buildProjectStructure) still open → discovered May fixed it in her own heartbeat this cycle
- Seeded 2 test items in May's todo: (1) self-executable optimizer check, (2) Scout research dispatch
- Spawned May as attached session (s_1773099142776_46, 3m55s, 11 turns)
- Scored exercise: 13.5/15 (PASS — self-execution ✅, routing ✅, context ✅, follow-through ✅, brevity ✅, paths ✅, no re-reads ✅; gap: `delegate` vs `subagents.run`)
- May proactively created `agents/bob/knowledge/coaching.md` with 3 adversity-handling corrections — unblocking Bob's coaching path
- May dispatched Scout for research, received 10-entry report (153 lines), archived both todo items
- Wrote coaching report (sessions/may-exercise-3-2026-03-09.md)
- Updated COACHEES.md (May streak 3/3, session #3, graduation exercise next, dashboard refreshed)
- Updated todo.md (May graduation exercise as top priority, Bob exercise #4 unblocked, infra blocker resolved)

**Key findings:**
- **Over-delegation: RESOLVED** — May self-executed optimizer check AND created Bob's coaching.md instead of dispatching
- **Brevity: ~160 tokens** — steady improvement from 500-700 → 291 → 160. Approaching target.
- **Initiative: HIGH** — proactively unblocked Bob's graduation path by creating coaching.md herself
- **New gap: `delegate` vs `subagents.run`** — May uses blocking `delegate` for dispatch instead of async `subagents.run`. Low severity in heartbeat context.
- **Infra blocker resolved** — May fixed `buildProjectStructure` in her own heartbeat. Detached sessions should now work.

**Next priorities:**
- May GRADUATION EXERCISE (3/3 streak) → potential 3rd graduated agent
- Bob exercise #4 (corrections applied, ready to rebuild streak)
- Escalate `subagents.run` vs `delegate` clarification to optimizer

---

### 2026-03-09 — Heartbeat (4th+5th)
**Activity:** COACHEES review + May heartbeat exercise #2 (config verification, no scaffolding) + Scout graduation re-test
**Result:** May PASS (8/10). Scout PASS (14/14, perfect). **🎓 SCOUT GRADUATED.** Over-delegation identified as new gap.
**Note:** Combined entry for heartbeats 4+5 (see individual entries below).

---

### 2026-03-09 — Heartbeat (4th)
**Activity:** COACHEES review + May heartbeat exercise #2 (config verification, no scaffolding)
**Result:** May PASS (8/10). Action bias confirmed without scaffolding. Config rewrite working. Over-delegation identified as new gap.
**Actions taken:**
- Reviewed todo.md and periodic-tasks.md: COACHEES review was most overdue periodic task
- Reviewed May's full rewritten config (SOUL, DOMAIN, TOOLS, LESSONS, heartbeat): no gaps found
- Seeded test task (team.md accuracy verification) into May's active todo
- Attempted detached session first — **BLOCKED by infra**: `buildProjectStructure` import error in manager.ts crashes all detached processes
- Fell back to attached `delegate` (s_1773095966783_34, 2m33s, 9 turns)
- Scored exercise: 8/10 (PASS — action bias ✅, paths ✅, no re-reads ✅, follow-through ✅, brevity ⚠️, over-delegation ⚠️)
- Scout completed team.md audit during exercise: 1 mismatch found and fixed (Scout model changed from gemini-3-pro to opus)
- Wrote coaching report (sessions/may-heartbeat-exercise-2-2026-03-09.md)
- Updated COACHEES.md (May streak 2/3, session #2, new findings, updated dashboard)
- Updated todo.md (May coaching item progressed, infra blocker escalation needed)

**Key findings:**
- May's config rewrite is effective — all K1-K7 lessons are working
- Action bias is internalized — no scaffolding needed (confirms 2026-03-09 finding)
- Over-delegation: May sent a simple file-comparison task to Scout when she could have done it herself. DOMAIN.md doesn't address self-execution vs delegation threshold.
- **INFRA BLOCKER**: `buildProjectStructure` is imported in `src/manager.ts:35` but doesn't exist in `src/tools.ts`. ALL detached sessions crash. This blocks standard coaching methodology.

**Next priorities:**
- Escalate detached session infra blocker to May
- Escalate May coaching corrections (self-execution guidance, brevity example) to optimizer
- May exercise #3 if infra is fixed — if PASS → graduation exercise for 3rd agent

---
