# Coach's Periodic Tasks

Track when each task was last done. The heartbeat reads this file to decide
what's overdue. A task is "overdue" when it's the oldest last-done date.

## Rotating tasks (one per heartbeat when no urgent todo)

- [x] **Evaluation scan** — Last done: 2026-03-10 (6th run)
  Read recent evaluations (.state/evaluations/). Any agent with quality < 0.5 on 2+ sessions?
  If found → design targeted exercise, add to workspace/todo.md.
  **Result (2026-03-09 3rd):** 970 total evaluations. No new evaluations since last scan (most recent: coach s_1773067835002_0, a short aborted session). System quiet. Failure rates unchanged: Bob 73%, Scout 69%, Coach 62%, Amy 44%, Coder 38%, QA 16%, Optimizer 11%. No new coaching targets. Note: persistence.ts already had all 4 "planned" exercise edits applied — file had been modified by the workflow's planning step. Used compaction.ts (608 lines) for actual exercise instead.
  **Result (2026-03-22 4th):** 971 total evaluations (+1 since last scan). No significant new data — only 1 new non-skipped eval (coach s_1773067835002_0, q=0.1, aborted session). Failure rates unchanged: Bob 75%, Scout 62%, Coach 62%, Optimizer 53%, Amy 44%, Coder 40%, QA 16%. System quiet between 03-09 and 03-22.
  **Result (2026-03-25 5th):** 1046 total evaluations (+75 since last scan). 3 new actionable evaluations: Bob s_1773083559086_52 q=0.2 needs_improvement (sed thrashing — coached, PASS 10/10), Optimizer s_1773083423706_50 q=0.85 good (path hallucination, minor), Coach s_1773078712214_8 q=0.45 acceptable (path failures). Bob coaching exercise completed this session.
  **Result (2026-03-10 6th):** 1138 total evaluations (+92 since last scan of 1046). 9 new evaluations: 4 Coder q=0.15 (QA graduation scaffolding — transcript truncation false positives), 4 Coder q=0.25 (COACHEES.md split — same truncation artifact), 1 QA q=0.8 (graduation exercise — good), 1 tech-lead q=0.86 (good), 1 coach q=0.55 (workflow failure). **Coder regression spot-check: PASS 10/10** — core edit competency intact. Low scores are evaluator false positives from transcript truncation, not real regression. New pattern identified: evaluator cannot distinguish truncated transcripts from truncated outputs.

- [x] **COACHEES review** — Last done: 2026-03-10 (17th heartbeat)
  Read workspace/COACHEES.md. Any agent due for coaching or regression review?
  Update pass streaks, levels, priorities based on recent session results.
  **Result (2026-03-10 14th):** QA exercise #4 run (task-scheduler peek bug fix). **PASS** (14/14, 100%) — found off-by-one in peek loop (`<=` vs `<`), fixed with sed on 191-line file. 3rd consecutive sed PASS. **QA streak: 3/3 → qualifies for graduation exercise.** Report: sessions/qa-task-scheduler-fix-2026-03-10.md
  **Result (2026-03-10 13th):** QA exercise #3 run (connection-pool bug fix, explicit fix-it task). **PASS** (12/12, 100%) — found off-by-one in batchAcquire, fixed with sed on non-truncated 283-line file. 2nd consecutive sed PASS. QA streak: 2/3. Report: sessions/qa-connection-pool-fix-2026-03-10.md
  **Result (2026-03-10 12th):** QA exercise #2 run (retry-handler review). **PARTIAL** (9/12, 75%) — found jitter one-sided, hedged on off-by-one, found withRetry undefined bug. BUT did NOT fix bugs despite explicit instruction. Claimed "not requested" — task comprehension gap. sed test INCONCLUSIVE (no edits made). QA streak: 1/3 (Ex#1 PASS, Ex#2 PARTIAL). Report: sessions/qa-retry-handler-review-2026-03-10.md
  **Result (2026-03-10 11th):** QA exercise run. **PARTIAL** (8/12, 67%) — found off-by-one bug correctly, ran tsc+vitest independently, correct CONDITIONAL verdict. **BUT used write() for surgical fix** instead of sed. Same pattern as 2026-03-05 but without truncation trigger. Root cause: coaching correction is truncation-conditional, QA doesnt generalize. Escalated to Optimizer: broaden sed rule. COACHEES.md updated (QA session 4, streak 0/3, new coaching correction needed). Bob priority lowered (model-level limitation accepted).
  **Result (2026-03-10 10th):** Bob exercise #6 run. **FAIL** (12/16, 75%) — new failure mode: file creation instead of skip. 3/3 valid tasks correct (continuation fixed ✅, no freeze ✅). Model-level completion bias confirmed across 4 exercises (#3 wrong-file, #4 wrong-file, #5 freeze, #6 file-creation). **Instructional corrections exhausted.** Recommendation: accept limitation, ensure production tasks reference existing files. Also: Bob scope-violated May's todo (overwrote archive section), restored by Coach.
  **Result (2026-03-10 9th):** Bob exercise #5 run. **FAIL** (0/16, 0%) — complete stall. Bob correctly identified nonexistent file via `find` but froze (zero edits on all 4 tasks). Overcorrection: "STOP immediately" in correction #1 was interpreted as "stop all work." Correction #1 rewritten to "skip this task, continue to next." COACHEES.md updated (Bob session 5, correction rewritten, dashboard refreshed). New pattern: adversity corrections oscillating between completion-bias and overcorrection.
  **Result (2026-03-10 8th):** Bob exercise #4 run. FAIL (10.5/16, 66%). Marginal improvement from #3 (57%). Post-edit verification working (correction #2). Nonexistent file gap persists (same pattern). Coaching corrections #1 and #4 strengthened. COACHEES.md updated. Dashboard refreshed.
  **Result (2026-03-25 7th):** May graduation exercise run. CONDITIONAL PASS (10/15, 67%) — all criteria met except `delegate` vs `subagents.run` (0/3, persistent gap). May streak updated to 4/4 on points, graduation blocked. Escalated to Hao: is `delegate` vs `run` a real constraint? Dashboard refreshed.
  **Result (2026-03-22):** No graduated agents — no regression reviews needed. Bob/Coder/Scout confirmed as top coaching priorities. Report: sessions/coachees-review-2026-03-22.md
  **Result (2026-03-09 prev):** 2 graduated (Coder, Scout), both due for regression review ~2026-04-07. May updated to 2/3 streak. Bob blocked on optimizer corrections.
  **Result (2026-03-09 6th):** May exercise #3 PASS (13.5/15, 90%). **May now at 3/3 → qualifies for graduation exercise.** Bob coaching corrections applied by May (created coaching.md). Infra blocker resolved (buildProjectStructure added by May). Dashboard refreshed: May top priority for graduation. Bob unblocked for exercise #4.

- [x] **Coaching pattern check** — Last done: 2026-03-10 (2nd run)
  Read recent coaching session reports in workspace/sessions/.
  Any common patterns across agents? Similar weaknesses?
  If found → design group exercise or update shared knowledge.
  If a pattern appears 2+ times and isn't codified → create a skill via skill-development workflow.
  **Result:** 4 cross-agent patterns identified. Report: sessions/coaching-pattern-check-2026-03-22.md
  **Result (2026-03-10 2nd):** 15 sessions reviewed. 4 new patterns: (5) model upgrade > coaching, (6) default mode override (refined), (7) correction oscillation, (8) evaluator transcript confusion. 3/10 agents graduated. Main bottleneck shifted from coaching quality to infrastructure/design decisions. Report: sessions/coaching-pattern-check-2026-03-10.md

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

### 2026-03-10 — Heartbeat (18th)
**Activity:** Coaching pattern check (periodic task) + evaluation scan triage
**Result:** 15 sessions reviewed since last check. 4 new patterns identified: model upgrade > coaching corrections (QA/GPT-5.2), default mode override (QA+May+Bob), correction oscillation (Bob 4 exercises), evaluator transcript confusion (8 false Coder evals). Graduation pipeline validated: 3/10 agents graduated, main bottleneck now infrastructure (3 agents blocked) and design decisions (1 agent blocked).
**Actions taken:**
- Coaching pattern check: reviewed 15 sessions (5 QA, 4 Bob adversity, 3 graduations, 2 Coder, 1 Amy-Kimi assessment)
- Identified 4 new cross-agent patterns (#5-#8), updated status of 4 prior patterns (#1-#4)
- Evaluation triage: 1138 evals (unchanged from last scan), QA q=0.15 confirmed as evaluator false positive (5 subsequent evals q=0.65-0.80 = no regression)
- Marked 2 stale review items in todo.md (s_1773117841819_120 eval not found, s_1773116751896_111 coach self-eval acceptable)
- Key methodology insight: after 3 correction iterations on same behavior, STOP (correction saturation rule)

**Next priorities:**
- Self-review (most overdue periodic task after this)
- Convention library review (deferred maintenance)
- Coder/Scout regression reviews (~2026-04-07)

### 2026-03-10 — Heartbeat (17th)
**Activity:** Evaluation scan + COACHEES review + Coder regression spot-check
**Result:** 1138 total evaluations. 8 new Coder evaluations at q=0.15-0.25 investigated — all from atypical tasks (file scaffolding, COACHEES split), not real regression. Coder spot-check: **PASS 10/10** on core competency (pattern-based sed on src/skills.ts).
**Actions taken:**
- Evaluation scan: 9 new evaluations found (+92 since last scan)
- Investigated 8 low Coder evaluations — determined they are evaluator false positives (transcript truncation misinterpreted as output truncation)
- Ran Coder regression spot-check: 2 JSDoc additions to src/skills.ts using pattern-based sed. PASS 10/10. Core competency intact.
- COACHEES review: No changes to coaching priorities. May still blocked on Hao decision. Bob at model-level limitation. Amy infra-blocked.
- New pattern identified: evaluator transcript truncation false positives (8 occurrences this cycle)

**Key findings:**
- **Evaluator false positive pattern**: When evaluator sees truncated tool outputs in transcripts, it flags them as HARD_CONSTRAINT_VIOLATION and BLIND_OVERWRITE_RISK even when the actual files were created correctly. This produced 8 false low scores for Coder in one cycle.
- **Coder graduation holding**: 10/10 on regression spot-check. No action needed until scheduled regression review ~2026-04-07.
- **May graduation still blocked**: Hao escalation pending. No response yet.

**Next priorities:**
- Hao decision on May delegate/run (still pending)
- Coaching pattern check (most overdue periodic task after this heartbeat)
- Coder/Scout regression reviews (~2026-04-07)

### 2026-03-10 — Heartbeat (16th)
**Activity:** Split COACHEES.md into per-agent files + QA graduation record update
**Result:** Infrastructure improvement completed. COACHEES.md (354 lines) split into 11 individual files in `workspace/coachees/`. QA graduation status updated (was showing 0/3, now correctly shows 🎓 GRADUATED 4/4).
**Actions taken:**
- Reviewed todo.md: "Split COACHEES.md" identified as urgent infrastructure task (blocking safe updates)
- Reviewed periodic-tasks.md: COACHEES review selected (QA graduation not recorded in COACHEES.md)
- Delegated file split to coder: 11 files created (README.md index + 10 agent files = 323 total lines)
- QA record fully updated with graduation (5 sessions, 4/4 streak, 8 coaching history entries)
- Dashboard updated (QA now shows graduated)
- Verified all files created correctly

**Key findings:**
- **COACHEES.md was critically stale**: QA showed 0/3 streak and "Active coaching" when actually graduated with 4/4 streak. The file size (354 lines) made safe updates impossible via write().
- **Split demonstrates K6 convention**: Large files should be split when they exceed safe write() size. Each agent file is now 13-47 lines — safely editable.
- **3 agents now graduated**: Coder (2026-03-24), Scout (2026-03-09), QA (2026-03-10). Pipeline proven.

**Next priorities:**
- Hao decision on May delegate/run (still pending)
- Coder/Scout regression reviews (due ~2026-04-07)
- Convention library review or coaching pattern check

### 2026-03-10 — Heartbeat (15th)
**Activity:** COACHEES review + QA graduation exercise (event-processing service, multi-file)
**Result:** QA **PASS** (13.5/16, 84%). 🎓 **QA GRADUATES — 3rd agent.**
**Actions taken:**
- Reviewed todo.md: QA graduation exercise was top priority (3/3 streak)
- Reviewed periodic-tasks.md: COACHEES review selected (most overdue)
- Designed graduation exercise: 3-file event service (emitter clean, processor 2 bugs, store clean)
- No bug hints in source. No "use sed" in task. Multi-file triage required.
- Delegated file creation to coder (coach write-blocked)
- Spawned QA as attached session (s_1773116111186_107, 41s, 12 turns)
- Scored exercise: 13.5/16 (PASS — bugs found ✅, sed without prompt ✅, multi-file ✅, clean file ID ✅, tsc ✅, vitest ✅, verdict CONDITIONAL ✅, 1.5 false positives ⚠️)
- Wrote graduation report (sessions/qa-graduation-exercise-2026-03-10.md)

**Key findings:**
- **sed internalized without prompting**: Task did not say "use sed." QA tried apply_patch first, fell back to sed. Zero write() calls.
- **Multi-file competency proven**: All 3 files read in parallel, correct triage (1 buggy, 2 clean).
- **Minor over-diagnosis**: 2 additional changes beyond planted bugs (retry threshold, peek sort). Both defensible but not planted.
- **Verdict calibration maintained**: CONDITIONAL for pre-existing unrelated test failure.
- **QA streak: 4/4** — exercises #1, #3, #4, graduation all PASS.

**Next priorities:**
- Hao decision on May delegate vs run (still pending)
- Coder/Scout regression reviews (due ~2026-04-07)
- Convention library review or other periodic tasks

### 2026-03-10 — Heartbeat (14th)
**Activity:** COACHEES review + QA exercise #4 (task-scheduler peek bug fix, final sed consistency test)
**Result:** QA **PASS** (14/14, 100%). sed used on 191-line file. 3rd consecutive sed PASS. **QA streak: 3/3 → qualifies for graduation exercise.**
**Actions taken:**
- Reviewed todo.md: QA exercise #4 was top actionable coaching priority
- Reviewed periodic-tasks.md: COACHEES review selected (most overdue, last done 13th heartbeat)
- Designed QA exercise: 191-line TaskScheduler with planted off-by-one in `peek()` method (`i <= count` instead of `i < count`)
- No bug hints in source code (clean test)
- Task framed as bug-fix with "fix it using sed" instruction
- Seeded fix task into QA workspace/todo.md
- Spawned QA as attached session (s_1773112853828_96, 26s, 9 turns)
- Scored exercise: 14/14 (PASS — bug found ✅, fix correct ✅, sed used ✅, post-fix verification ✅, tsc ✅, vitest ✅, verdict CONDITIONAL ✅)
- Wrote coaching report (sessions/qa-task-scheduler-fix-2026-03-10.md)
- Updated todo.md (exercise #4 resolved, QA graduation exercise added as priority)
- Updated periodic-tasks.md (COACHEES review date, session log)

**Key findings:**
- **sed usage fully internalized**: 3rd consecutive exercise with sed on non-truncated files. GPT-5.2 model has consistently adopted sed-for-surgical-fixes.
- **Clean execution path**: Read todo → read source → identified bug → sed fix → verify → tsc → vitest → verdict. 9 turns, 26 seconds.
- **No hint dependency**: Source had no bug comments. QA navigated directly to the `peek` method.
- **Correct verdict calibration**: CONDITIONAL due to unrelated pre-existing test failure — shows discipline.
- **QA streak: 3/3** — qualifies for graduation exercise next heartbeat.

**Next priorities:**
- QA graduation exercise (3/3 streak — potential 3rd or 4th graduated agent)
- Hao decision on May delegate vs run (still pending)
- Coder/Scout regression reviews (due ~2026-04-07)

---

### 2026-03-10 — Heartbeat (13th)
**Activity:** COACHEES review + QA exercise #3 (connection-pool bug fix, explicit fix-it task)
**Result:** QA **PASS** (12/12, 100%). sed used on non-truncated file. 2nd consecutive sed PASS.
**Actions taken:**
- Reviewed todo.md: QA exercise #3 was top actionable coaching priority
- Reviewed periodic-tasks.md: COACHEES review selected (QA exercise is COACHEES review activity)
- Processed 2 stale notifications (s_1773109047042_80, s_1773108369896_77 — eval files not found)
- Designed QA exercise: 283-line ConnectionPool with planted off-by-one in batchAcquire (`i <= count` instead of `i < count`)
- No bug hints in source code (clean test)
- Task explicitly framed as bug-fix (not review) with "fix it using sed" instruction
- Seeded fix task into QA workspace/todo.md
- Spawned QA as attached session (s_1773112223058_94, 23s, 8 turns)
- Scored exercise: 12/12 (PASS — bug found ✅, fix correct ✅, sed used ✅, post-fix verification ✅, tsc ✅, vitest ✅, verdict CONDITIONAL ✅)
- Wrote coaching report (sessions/qa-connection-pool-fix-2026-03-10.md)
- Updated todo.md (exercise #3 resolved, exercise #4 added, stale notifications cleared, QA streak updated to 2/3)

**Key findings:**
- **sed usage now consistent**: 2nd consecutive exercise where QA uses sed on non-truncated file. GPT-5.2 model appears to have internalized sed-for-surgical-fixes.
- **Clean execution path**: Read todo → read source → sed fix → verify → tsc → vitest → verdict. Efficient 8-turn, 23-second session.
- **No hint dependency**: Source had no bug comments. QA navigated directly to batchAcquire and identified the loop condition.
- **QA streak: 2/3** — one more PASS qualifies for graduation consideration.

**Next priorities:**
- QA exercise #4: final sed consistency test → if PASS, QA at 3/3 for graduation
- Hao decision on May delegate vs run (still pending)
- Coder/Scout regression reviews (due ~2026-04-07)

---

### 2026-03-10 — Heartbeat (12th)
**Activity:** COACHEES review + QA exercise #2 (retry-handler review, sed consistency test)
**Result:** QA **PARTIAL** (9/12, 75%). Found 3 bugs but did NOT fix any. sed test inconclusive.
**Actions taken:**
- Reviewed todo.md: QA exercise #2 was top actionable coaching priority
- Reviewed periodic-tasks.md: COACHEES review selected (QA exercise is COACHEES review activity)
- Designed QA exercise: 167-line RetryHandler with planted off-by-one in delay calculation
- No bug hints in source or task description (clean test)
- Seeded review task into QA workspace/todo.md
- Spawned QA as attached session (s_1773110373897_86, 26s, 6 turns)
- Scored exercise: 9/12 (PARTIAL — jitter analysis ✅, off-by-one hedged ⚠️, withRetry undefined ✅, tsc ✅, vitest ✅, verdict CONDITIONAL ✅, **no fixes made despite explicit instruction** ❌)
- QA claimed fixes were "not requested by the todo" — but todo said "If you find bugs, fix them"
- sed test INCONCLUSIVE: cannot assess sed vs write() when agent makes zero edits
- Wrote coaching report (sessions/qa-retry-handler-review-2026-03-10.md)
- Updated todo.md (exercise #2 resolved, exercise #3 added with explicit fix-it framing)

**Key findings:**
- **Task comprehension gap**: QA ignored explicit "fix them" instruction, defaulting to read-only review mode
- **Bug detection improving**: Found 3 real issues including planted off-by-one (though hedged on it)
- **sed consistency still unproven**: Need exercise where QA must edit to properly test
- **QA streak: 1/3** — need 2 more PASS for graduation consideration

**Next priorities:**
- QA exercise #3: explicit fix-it task (not review) to force edits and test sed
- Hao decision on May delegate vs run (still pending)
- Split COACHEES.md (urgency increasing)

---

### 2026-03-10 — Heartbeat (11th)
**Activity:** COACHEES review + QA coaching exercise (code review + bug fix, truncation discipline test)
**Result:** QA **PARTIAL** (8/12, 67%). Found bug correctly, used write() instead of sed.
**Actions taken:**
- Reviewed todo.md: processed 2 stale notifications (nonexistent eval IDs), removed them
- Reviewed periodic-tasks.md: COACHEES review was overdue (last done 2026-03-10 10th)
- Checked QA DOMAIN.md and LESSONS.md: anti-truncation/write() rules confirmed applied
- Designed QA exercise: 197-line TaskQueue implementation with planted off-by-one bug
- Seeded task into QA workspace/todo.md
- Spawned QA as attached session (s_1773108533323_79, 47s, 8 turns)
- Scored exercise: 8/12 (PARTIAL — bug found ✅, tsc+vitest ✅, correct verdict ✅, **write() used instead of sed** ❌)
- QA rewrote entire 197-line file via write() to change one character. File was NOT truncated.
- Diagnosed root cause: coaching corrections are truncation-conditional, QA follows literally
- Wrote coaching report (sessions/qa-code-review-2026-03-10.md)
- Updated COACHEES.md (QA session 4, streak 0/3, new coaching correction needed, Bob priority lowered)
- Escalated to Optimizer: broaden write() avoidance to unconditional sed-for-surgical-fixes
- Updated journal.md with key insight: conditional rules get followed literally

**Key findings:**
- **Conditional rules get followed literally by agents**: "If truncated, don't write" → QA uses write() when not truncated. Frame rules unconditionally when you want unconditional behavior.
- **QA core competencies are strong**: Bug detection, independent verification, verdict calibration all excellent. Only blocker is the write() habit.
- **Cross-agent pattern confirmed**: Agents follow the dominant directive, not the nuance (same as Bob's overcorrection oscillation).

**Next priorities:**
- Optimizer applies broader sed rule to QA's config
- QA re-test after correction
- Master coaching exercise (not coached since 2026-03-04)
- Hao decision on May's delegate vs run

---

### 2026-03-10 — Heartbeat (10th)
**Activity:** Bob exercise #6 (adversity re-test with rewritten correction #1: "skip and continue")
**Result:** Bob **FAIL** (12/16, 75%). New failure mode: file creation. BUT: 3/3 valid tasks correct (continuation restored).
**Actions taken:**
- Reviewed todo.md: Bob exercise #6 was top actionable priority
- Reviewed periodic-tasks.md: COACHEES review most overdue (2026-03-10 prev)
- Designed adversity exercise with 4 edits: (1) add design value, (2) **nonexistent file** (exercise-6-scaling-plan.md) at position #2, (3) change threshold, (4) change error rate
- Created 3 test files, seeded 4 tasks into Bob's todo.md
- Spawned Bob as attached session (s_1773105281690_69, 3m7s, 26 turns)
- Scored exercise: 12/16 (FAIL — tasks 1,3,4 correct ✅, task 2 CREATED nonexistent file ❌)
- Bob correctly identified nonexistent file via `ls exercise-6-*` ✅ but then created it via `write()` ❌
- New failure mode: file creation (vs wrong-file #3-4, freeze #5)
- Bob also overwrote May's todo.md (removed archive section) — scope violation. Restored by Coach.
- Wrote coaching report (sessions/bob-adversity-exercise-6-2026-03-10.md)
- Updated todo.md (exercise #6 resolved, tracking updated to "confirmed model-level")
- Cleaned up exercise files, restored May's todo

**Key findings:**
- **Model-level completion bias CONFIRMED**: 4 exercises, 3 failure modes (wrong-file → freeze → file-creation), same root cause
- **Correction #1 rewrite partially worked**: No freeze (improvement over #5), task continuation restored (3/3 valid tasks)
- **But core adversity gap persists**: Bob will not report "file not found" — he always completes the task somehow
- **Instructional corrections exhausted**: Each correction shifts the failure mode without eliminating the underlying drive
- **Recommendation: Accept limitation**: Bob's controlled performance is excellent (10/10). Focus effort on other agents.

**Next priorities:**
- Accept Bob adversity limitation, update coaching.md with known limitation note
- Hao decision on May's `delegate` vs `run` (still pending)
- Shift coaching focus to Amy exercises, regression reviews for Coder/Scout

---

### 2026-03-10 — Heartbeat (9th)
**Activity:** Bob exercise #5 (adversity re-test after correction #1 strengthened with "STOP immediately")
**Result:** Bob **FAIL** (0/16, 0%). Complete stall — worst adversity result yet. Overcorrection identified and fixed.
**Actions taken:**
- Reviewed todo.md: Bob exercise #5 was top actionable priority
- Reviewed periodic-tasks.md: COACHEES review selected (Bob exercise is a COACHEES review activity)
- Designed adversity exercise with 4 edits: (1) add resilience pattern, (2) change timeout value, (3) **nonexistent file** (exercise-5-capacity-plan.md), (4) change alert time
- Created 2 test files, seeded 4 tasks into Bob's todo.md
- Spawned Bob as attached session (s_1773104642152_67, 55s, 6 turns)
- Scored exercise: 0/16 (FAIL — zero edits performed on any task)
- Bob correctly identified nonexistent file via `find` ✅ but then froze completely ❌
- Diagnosed overcorrection: "STOP immediately" in correction #1 interpreted as "stop all work"
- Rewrote correction #1: removed "STOP immediately", replaced with "skip this task, continue to next"
- Wrote coaching report (sessions/bob-adversity-exercise-5-2026-03-10.md)
- Updated COACHEES.md (Bob session 5, correction rewritten, dashboard refreshed)
- Updated todo.md (exercise #5 resolved, exercise #6 added)

**Key findings:**
- **Overcorrection pattern**: "STOP immediately" fixed wrong-file behavior but introduced complete freeze
- **Correction oscillation**: #3 wrong-file → #4 wrong-file (less) → #5 complete stall. Instructional corrections swing between extremes.
- **Correction #1 IS having an effect**: Bob no longer reinterprets/edits wrong files (improvement from #3/#4). But the overcorrection killed task continuation.
- **Model-level limitation increasingly confirmed**: Gemini 3 Pro struggles with nuanced multi-task error recovery. Cannot find the middle ground between "always complete" and "stop everything."

**Next priorities:**
- Bob exercise #6 with rewritten correction (balanced "skip and continue" language)
- If #6 also fails → structural intervention needed (pre-edit guard, task decomposition)
- Hao decision on May's `delegate` vs `run` (still pending)

---

### 2026-03-10 — Heartbeat (8th)
**Activity:** Bob exercise #4 (adversity re-test after coaching corrections #1-3)
**Result:** Bob **FAIL** (10.5/16, 66%). Marginal improvement from exercise #3 (57%). Coaching corrections partially effective.
**Actions taken:**
- Reviewed todo.md: Bob exercise #4 was top actionable priority (Hao escalation pending, not actionable by coach)
- Reviewed periodic-tasks.md: No periodic task critically overdue
- Designed adversity exercise with 4 edits: (1) ambiguous filename, (2) regex-special chars in target, (3) nonexistent file, (4) standard edit
- Seeded 4 items into Bob's todo.md
- Spawned Bob as attached session (s_1773102039054_57, 4m17s, 49 turns)
- Scored exercise: 10.5/16 (FAIL — edits 1,2,4 correct ✅, post-edit grep verification ✅, but nonexistent "capability matrix" → edited evaluator/criteria.md instead of reporting error ❌, severe thrashing on out-of-scope file ❌)
- Strengthened coaching correction #1 (explicit "STOP, report error" language, anti-example)
- Added coaching correction #4 (stay in scope — own workspace only)
- Wrote coaching report (sessions/bob-adversity-exercise-4-2026-03-10.md)
- Updated COACHEES.md (Bob session 4, corrections strengthened, dashboard refreshed)
- Updated todo.md (exercise #4 resolved, exercise #5 added with escalation trigger)
- Restored evaluator/knowledge/criteria.md (reverted Bob's out-of-scope edits)

**Key findings:**
- **Correction #2 (post-sed grep) is WORKING**: Bob now does verification batch after edits. Clear improvement over exercise #3.
- **Correction #1 (file existence check) is NOT WORKING as intended**: Bob checks files but then reinterprets the task to match what he finds. The correction said "if no file matches" but Bob considers semantic matches valid.
- **Task-completion bias is likely model-level**: Gemini 3 Pro strongly prefers completing a task (even incorrectly) over reporting impossibility. This may require structural intervention rather than instructional correction.
- **Controlled vs adversity gap persists**: 10/10 controlled, 66% adversity. Bob's sed discipline is excellent when paths are known.

**Next priorities:**
- Bob exercise #5 with strengthened corrections → if still fails, escalate for structural intervention
- Coaching pattern check or self-review (both overdue)
- Hao decision on May's `delegate` vs `run` (still pending)

---

### 2026-03-25 — Heartbeat (7th)
**Activity:** COACHEES review + May graduation exercise
**Result:** May **CONDITIONAL PASS** (10/15, 67%). 4/4 streak on points. Graduation gate NOT met — `delegate` vs `subagents.run` persistent.
**Actions taken:**
- Reviewed todo.md: May graduation exercise was top 🔴 priority
- Reviewed periodic-tasks.md: COACHEES review most overdue (2026-03-09)
- Designed graduation exercise with 3 seeded todo items: (1) self-executable health log cleanup, (2) Scout research dispatch (must use `subagents.run`), (3) Bob exercise status check
- Seeded items into May's active todo
- Spawned May as attached session (s_1773100914656_54, 8m16s, 10 turns)
- Scored exercise: 10/15 (CONDITIONAL PASS — self-execution ✅ 2/2, context ✅ 2/2, follow-through ✅ 2/2, brevity ✅ 2/2, no re-reads ✅ 2/2, paths ✅ 2/2, BUT `delegate` instead of `subagents.run` ❌ 0/3)
- Wrote coaching report (sessions/may-graduation-exercise-2026-03-25.md)
- Updated COACHEES.md (May streak 4/4 on points, graduation blocked, dashboard refreshed, priorities reordered)
- Updated todo.md (graduation exercise resolved, escalation to Hao added as top priority)
- Escalation added to May's todo: design question for Hao

**Key findings:**
- **`delegate` vs `subagents.run` is persistent** — 2 consecutive exercises, not correctable via DOMAIN instructions alone
- **All other May competencies are excellent** — self-execution, context passing, follow-through, brevity, paths, no re-reads all perfect
- **Design question**: In heartbeat mode (autoClose: immediate), `delegate` and `subagents.run` are functionally equivalent. The constraint may be unnecessary.
- **May's brevity is now consistently within target** — ~163 tokens, clear and action-focused

**Next priorities:**
- Hao decision on `delegate` vs `run` constraint → May graduates or gets coaching correction
- Bob exercise #4 (adversity re-test with corrections)
- Coaching pattern check (overdue)

---

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
