# TODO

- [x] [STALE] Review session s_1773120271796_139 — coach self-session, evaluation file not found. No action needed.
- [x] [STALE] Review session s_1773117841819_120 — evaluation file not found.
- [x] [STALE] Review session s_1773116751896_111 — coach self-eval, q=0.55, acceptable. No action needed.
## 🔴 NEXT ACTIONS

- [x] **🔴 ESCALATION TO HAO**: Is `delegate` vs `subagents.run` a meaningful distinction in heartbeat mode? **YES, CRITICAL. (See workspace/design-verdict-delegation.md)**
- [x] **Escalate May coaching corrections to Optimizer** — ✅ Already applied. LESSONS.md anti-pattern in place. May GRADUATED 2026-03-10 (15/15, 100%). Report: `sessions/may-graduation-retest-2026-03-10.md`.
- [x] **QA GRADUATION EXERCISE** — QA at 3/3 streak (exercises #1, #3, #4 all PASS with sed). Design graduation exercise: multi-file review, independent test writing, sed for fixes, complex scenario. If PASS → **QA graduates (THIRD or FOURTH AGENT).**
- [ ] **Coder — First Regression Review** — Schedule for ~2026-04-07. Re-run graduation exercise or equivalent multi-file mixed edit. Per regression-review-process.md.
- [ ] **Scout — First Regression Review** — Schedule for ~2026-04-07. Re-run graduation exercise or equivalent multi-source research task. Per regression-review-process.md.

## Active Items

- [ ] **Coach Amy-Kimi** — Same exploration cycle exercise as Amy. Verify tool failure handling, actionable insights, frequency discipline, archive synthesis.
- [ ] **Amy exercise 2** — L2 assessment: ambiguous/self-directed task. Open-ended exploration prompt, see if Amy can self-direct.
- [ ] **Amy live search validation** — When XHS access is restored, re-run full search→read→archive pipeline.
- [x] **Apply COACHEES.md updates** — See `workspace/coachees-update-2026-03-25.md` for pending QA and Master updates. COACHEES.md too large for safe write() — need Split COACHEES.md first.

## Convention Library (2026-03-05)

A structured convention library was seeded at `agents/coach/skills/agent-conventions/`.
The SKILL.md is the index; detailed docs are in structure.md, behavior.md, knowledge-mgmt.md,
coordination.md, operational.md. Coach should review, enrich, and use these for coaching.

- [x] **Review convention library against reality** — ✅ Done 2026-03-10. Reviewed all 35 conventions against 1158 evaluations + 15 coaching sessions. Validated S1-S7, B8/B10, K2-K4/K6, C1/C3/C4/C7, O1-O3/O6. Most violated: B7 (16), B2 (14), B6 (8). B11 not tested by evaluator. Report: `sessions/convention-review-2026-03-10.md`.
- [x] **Identify convention gaps** — ✅ Done 2026-03-10. 3 new conventions added: B12 (pattern-based sed), O9 (correction saturation), O10 (model upgrade consideration). All backed by 2+ sessions of evidence. Convention library now at 37 total.
- [ ] **Design convention exercises** — For each Required convention, design at least one exercise that tests it. Start with B1 (read before write), B7 (project-relative paths), and K1 (don't re-read auto-loaded files) — these are the most commonly violated.
- [x] **Split COACHEES.md** — Current file is ~23KB and requires multiple reads to update one agent's section. Split into `agents/coach/workspace/coachees/<agent>.md` (one file per agent). Update DOMAIN.md to reference the new location. This demonstrates K6 (split large files). **URGENCY INCREASED** — Coach can't safely update COACHEES.md via write() due to truncation risk.
- [ ] **Add model-specific conventions** — Different models have different strengths/weaknesses. Gemini agents (Bob, Scout) may need different conventions than Opus agents (Coder, May) or GPT agents (QA, Evaluator). Review evaluation data by model family and draft model-specific recommendations.

---

## ✅ RESOLVED

- [x] **🎓 May GRADUATION RE-TEST** — PASS (15/15, 100%, 2026-03-10). Used `subagents.run` for both dispatches (Scout + tech-lead). Self-executed health check + QA report review. LESSONS.md anti-pattern effective. **4th GRADUATED AGENT. First supervisor.** Report: `sessions/may-graduation-retest-2026-03-10.md`.
- [x] **Convention library review** — ✅ Done 2026-03-10. First systematic review. 3 new conventions (B12, O9, O10). Report: `sessions/convention-review-2026-03-10.md`.
- [x] **QA exercise #4 — final sed consistency test** — PASS (14/14, 100%). sed used on 191-line TaskScheduler. 3rd consecutive sed PASS. QA streak: 3/3 → qualifies for graduation. Report: `sessions/qa-task-scheduler-fix-2026-03-10.md`.
- [x] **QA exercise #3 — explicit fix-it test** — PASS (12/12, 100%). QA used sed on non-truncated 283-line file. 2nd consecutive sed PASS. Streak: 2/3. Report: `sessions/qa-connection-pool-fix-2026-03-10.md`.
- [x] **QA exercise #2 — verify sed consistency** — PARTIAL (9/12, 75%). QA found bugs (jitter one-sided, off-by-one hedged, withRetry undefined) but did NOT fix them despite explicit instruction. Claimed "not requested" — task comprehension gap. sed test INCONCLUSIVE. Report: `sessions/qa-retry-handler-review-2026-03-10.md`.
- [x] **QA exercise — Rate Limiter Review** — PASS (12/12). QA used sed for first time on non-truncated file. GPT-5.2 model. Report: `sessions/qa-rate-limiter-review-2026-03-25.md`.
- [x] **Master exercise attempt** — BLOCKED by infrastructure. CLI tools (claude_code, gemini_cli) not available. Escalated to May.
- [x] **Bob exercise #6** — FAIL (12/16, 75%). New failure mode: Bob created nonexistent file instead of skipping. 3/3 valid tasks correct (continuation fixed, no freeze). Model-level completion bias confirmed across 4 exercises, 3 failure modes. Structural intervention recommended. Report: `sessions/bob-adversity-exercise-6-2026-03-10.md`.
- [x] **Bob exercise #5** — FAIL (0/16, 0%). Complete stall. Bob correctly identified nonexistent file via `find` but froze — zero edits on any task. Overcorrection: "STOP immediately" interpreted as "stop all work." Correction #1 rewritten. Report: `sessions/bob-adversity-exercise-5-2026-03-10.md`.
- [x] **Bob exercise #4** — FAIL (10.5/16, 66%). Marginal improvement from #3 (57%). Edits 1, 2, 4 correct. Post-edit grep verification ✅ (correction #2 working). But nonexistent "capability matrix" → edited evaluator/criteria.md instead of reporting error (same pattern). Thrashing on out-of-scope file. Corrections strengthened. Report: `sessions/bob-adversity-exercise-4-2026-03-10.md`.
- [x] **🔴 May GRADUATION EXERCISE** — Ran 2026-03-25. **CONDITIONAL PASS** (10/15, 67%). All criteria passed EXCEPT `subagents.run` vs `delegate` (0/3 — used `delegate` again). Graduation gate not met. Escalated to Hao. Report: `sessions/may-graduation-exercise-2026-03-25.md`.
- [x] **May exercise #3** — **PASS** (13.5/15, 90%). Self-executed optimizer check, proactively created Bob's coaching.md, dispatched Scout research with full params, followed through. Streak: 3/3. Report: sessions/may-exercise-3-2026-03-09.md
- [x] **🔴 INFRA BLOCKER: Detached sessions broken** — RESOLVED by May (2026-03-09). Added `buildProjectStructure` function to `src/tools.ts`.
- [x] **Bob coaching corrections** — APPLIED by May (2026-03-09). Created `agents/bob/knowledge/coaching.md` with 3 adversity-handling corrections.
- [x] **Coach Bob — Adversity Exercise #3** — FAIL (8.5/15, 57%). Streak reset 0/3. Report: sessions/bob-adversity-exercise-3-2026-03-25.md
- [x] **Escalate Bob coaching corrections to Optimizer** — Done. Later applied directly by May.
- [x] **Coach Scout — Graduation Re-test** — ✅ PASS (14/14). **🎓 SCOUT GRADUATED** (2026-03-09).
- [x] **Coach May — Config verification** — ✅ PASS (8/10). May streak: 2/3.
- [x] [STALE] Review session s_1773091334227_0 — evaluation file not found.
- [x] [STALE] Review sessions s_1773076800080_4, s_1773067534678_0, s_1773040169518_207, s_1772981153743_126, s_1772966696491_108
- [x] [STALE] Review sessions s_1773034599260_181, s_1772903691430_14
- [x] [STALE] Review sessions s_1773109047042_80, s_1773108369896_77 — evaluation files not found (2026-03-10).
- [x] **Optimizer: Apply Scout coaching corrections** — ✅ CONFIRMED APPLIED (2026-03-25).
- [x] **Coach Bob — Safe-Edit Discipline** — PASS (2026-03-09, 8/10).
- [x] **Coach Bob — Sed Discipline #2** — PASS (2026-03-25, 10/10). Streak: 2/3.
- [x] **Coach Amy — Identity Resolution** — FAIL (2026-03-22).
- [x] **Coach Scout — Constrained-Source Integrity** — PASS (2026-03-09, 7/10)
- [x] **Coach Scout — Exploration** — PASS (2026-03-22, 8/10).
- [x] **Coach Scout — Graduation Exercise** — FAIL (2026-03-09, 7/14). Streak reset 0/3.
- [x] **Coach Coder — Full arc** — Ex2: PARTIAL → Ex2b: PASS → Ex2c: PASS → Graduation: PASS. **🎓 GRADUATED** (2026-03-24).
- [x] **Escalate QA coaching correction to Optimizer** — Escalated to May instead (Optimizer slow). QA used sed in latest exercise anyway (GPT-5.2 model).
- [x] Infrastructure blocker (manager.hasAgent) — Resolved 2026-03-09.
- [x] **Verify team.md accuracy** — ✅ Done via May exercise (2026-03-09).

## Tracking

- ✅ Bob adversity gap CONFIRMED MODEL-LEVEL — exercises #3 (57%) wrong-file, #4 (66%) wrong-file, #5 (0%) freeze, #6 (75%) file-creation. 4 exercises, 3 failure modes, same root cause: Gemini 3 Pro completion bias. **Instructional corrections exhausted.** Recommendation: accept limitation, ensure production tasks reference existing files.
- [x] Coder graduation exercise — PASS (2026-03-24, 10/10). **FIRST GRADUATION.**
- [x] Scout graduation re-test — PASS (2026-03-09, 14/14). **SECOND GRADUATION.**
- ✅ QA sed consistency: Ex#1 PASS, Ex#3 PASS, Ex#4 PASS, Graduation PASS (13.5/16, 84%). **🎓 QA GRADUATED (2026-03-10).** Streak: 4/4.
- ✅ May graduation re-test — PASS (2026-03-10, 15/15, 100%). **🎓 MAY GRADUATED (2026-03-10).** Streak: 5/5. First supervisor.

## Evaluation Scan Results (2026-03-10 — 7th scan)
- **1158 total evaluations** (+20 since last scan of 1138). 20 new evaluations: 5 evaluator (skipped), 1 optimizer q=0.78 (good), 4 coder q=0.62 (acceptable), 5 coder q=0.35 (needs_improvement — COACHEES split false positives, already identified), 1 scout q=0.8 (good), 2 coder q=0.88 (good), 2 qa q=0.92 (good). No new actionable issues. Latest coder evals (q=0.88) confirm regression spot-check — core competency intact.
