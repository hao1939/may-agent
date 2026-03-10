# TODO

- Review session s_1773099142776_46 (verdict: needs_improvement). Check .state/evaluations/ for details. Identify which agent needs coaching and run a targeted exercise.
## 🔴 NEXT ACTIONS

- [ ] **🔴 May GRADUATION EXERCISE** — Design and run. May has 3/3 consecutive PASS streak. Must test: `subagents.run` (not `delegate`), full heartbeat cycle with dispatch + follow-up + self-execution, brevity ≤200 tokens. If PASS → **THIRD GRADUATED AGENT.**
- [ ] **Bob exercise #4** — Adversity re-test. Coaching corrections #1-3 now applied to `agents/bob/knowledge/coaching.md` (by May, 2026-03-09). Design exercise with ambiguous paths + nonexistent files. Must demonstrate: file existence check before editing, post-sed grep verification, diagnose-before-retry.
- [ ] **Escalate May coaching corrections to Optimizer** — Add `subagents.run` vs `delegate` clarification to May's LESSONS.md. (Self-execution guidance no longer needed — resolved organically.)
- [ ] **Coder — First Regression Review** — Schedule for ~2026-04-07. Re-run graduation exercise or equivalent multi-file mixed edit. Per regression-review-process.md.
- [ ] **Scout — First Regression Review** — Schedule for ~2026-04-07. Re-run graduation exercise or equivalent multi-source research task. Per regression-review-process.md.

## Active Items

- [ ] **Coach Amy-Kimi** — Same exploration cycle exercise as Amy. Verify tool failure handling, actionable insights, frequency discipline, archive synthesis.
- [ ] **Amy exercise 2** — L2 assessment: ambiguous/self-directed task. Open-ended exploration prompt, see if Amy can self-direct.
- [ ] **Amy live search validation** — When XHS access is restored, re-run full search→read→archive pipeline.

## Convention Library (2026-03-05)

A structured convention library was seeded at `agents/coach/skills/agent-conventions/`.
The SKILL.md is the index; detailed docs are in structure.md, behavior.md, knowledge-mgmt.md,
coordination.md, operational.md. Coach should review, enrich, and use these for coaching.

- [ ] **Review convention library against reality** — Run `convention-review` workflow. Read each convention file and verify against actual agent behavior in recent sessions (`.state/evaluations/`). Flag any conventions that don't match what agents actually do. Are there patterns agents follow that aren't captured yet?
- [ ] **Identify convention gaps** — Read recent evaluation data for agents scoring below 0.5. What recurring failures aren't covered by existing conventions? Draft new conventions with IDs, classify them, add to the appropriate file.
- [ ] **Design convention exercises** — For each Required convention, design at least one exercise that tests it. Start with B1 (read before write), B7 (project-relative paths), and K1 (don't re-read auto-loaded files) — these are the most commonly violated.
- [ ] **Split COACHEES.md** — Current file is ~22KB and requires multiple reads to update one agent's section. Split into `agents/coach/workspace/coachees/<agent>.md` (one file per agent). Update DOMAIN.md to reference the new location. This demonstrates K6 (split large files).
- [ ] **Add model-specific conventions** — Different models have different strengths/weaknesses. Gemini agents (Bob, Scout) may need different conventions than Opus agents (Coder, May) or GPT agents (QA, Evaluator). Review evaluation data by model family and draft model-specific recommendations.

---

## ✅ RESOLVED

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
- [x] **Optimizer: Apply Scout coaching corrections** — ✅ CONFIRMED APPLIED (2026-03-25).
- [x] **Coach Bob — Safe-Edit Discipline** — PASS (2026-03-09, 8/10).
- [x] **Coach Bob — Sed Discipline #2** — PASS (2026-03-25, 10/10). Streak: 2/3.
- [x] **Coach Amy — Identity Resolution** — FAIL (2026-03-22).
- [x] **Coach Scout — Constrained-Source Integrity** — PASS (2026-03-09, 7/10)
- [x] **Coach Scout — Exploration** — PASS (2026-03-22, 8/10).
- [x] **Coach Scout — Graduation Exercise** — FAIL (2026-03-09, 7/14). Streak reset 0/3.
- [x] **Coach Coder — Full arc** — Ex2: PARTIAL → Ex2b: PASS → Ex2c: PASS → Graduation: PASS. **🎓 GRADUATED** (2026-03-24).
- [x] Infrastructure blocker (manager.hasAgent) — Resolved 2026-03-09.
- [x] **Verify team.md accuracy** — ✅ Done via May exercise (2026-03-09).

## Tracking

- ⚠️ Bob production regression (s_1773083559086_52) — q=0.2. Coached, corrections applied. Ready for exercise #4.
- [x] Coder graduation exercise — PASS (2026-03-24, 10/10). **FIRST GRADUATION.**
- [x] Scout graduation re-test — PASS (2026-03-09, 14/14). **SECOND GRADUATION.**
- [x] May exercise #3 — PASS (2026-03-09, 13.5/15, 90%). **3/3 streak → graduation exercise next.**

## Evaluation Scan Results (2026-03-25)
- **1094 total evaluations** (no new since last scan on 2026-03-09 23:00 UTC)
