# TODO

## 🔴 NEXT ACTIONS

- [ ] **Coach Bob — Adversity Exercise #3** — Multi-file edits with ambiguous paths. One target file exists, one doesn't. Tests error recovery + sed discipline under pressure. If PASS → 3/3 → SECOND GRADUATION.
- [ ] **Coach Scout — Graduation Re-test** — Corrections #11-13 now confirmed applied. Re-run graduation exercise: dedup against full canonical archive + budget discipline. If PASS → streak 1/3 (was reset).
- [ ] **Coach May — Config verification** — May's config was fully rewritten (SOUL, DOMAIN, TOOLS, LESSONS, heartbeat). Read May's SOUL.md first, then evaluate behavior against it, then coach if gaps found.
- [ ] **Coder — First Regression Review** — Schedule for ~2026-04-07. Re-run graduation exercise or equivalent multi-file mixed edit. Per regression-review-process.md.

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
- [ ] **Split COACHEES.md** — Current file is ~15KB and requires 6-8 reads to update one agent's section. Split into `agents/coach/workspace/coachees/<agent>.md` (one file per agent). Update DOMAIN.md to reference the new location. This demonstrates K6 (split large files).
- [ ] **Verify team.md accuracy** — Read `agents/shared/team.md` and compare each row against the actual `agents/*/agent.json` configs. Fix any mismatches.
- [ ] **Add model-specific conventions** — Different models have different strengths/weaknesses. Gemini agents (Bob, Scout) may need different conventions than Opus agents (Coder, May) or GPT agents (QA, Evaluator). Review evaluation data by model family and draft model-specific recommendations.

---

## ✅ RESOLVED

- [x] [STALE] Review sessions s_1773076800080_4, s_1773067534678_0, s_1773040169518_207, s_1772981153743_126, s_1772966696491_108 — Checked 2026-03-25: first session is actually "acceptable" (q=0.67), other 4 have no evaluations. All stale.
- [x] [STALE] Review sessions s_1773034599260_181, s_1772903691430_14 — Stale.
- [x] **Optimizer: Apply Scout coaching corrections** — ✅ CONFIRMED APPLIED (2026-03-25). Lessons #11, #12, #13 all present in `agents/scout/knowledge/coaching.md`. Scout graduation re-test is now unblocked.
- [x] **Coach Bob — Safe-Edit Discipline** — PASS (2026-03-09, 8/10). Report: sessions/bob-safe-edit-2026-03-09.md
- [x] **Coach Bob — Sed Discipline #2** — PASS (2026-03-25, 10/10). 4 pattern-based sed edits, batched in single exec, read-after-write verification. Streak: 2/3. Report: sessions/bob-sed-discipline-2-2026-03-25.md
- [x] **Coach Amy — Identity Resolution** — FAIL (2026-03-22). Amy identified as May. Report: sessions/amy-identity-exercise-2026-03-22.md
- [x] **Coach Scout — Constrained-Source Integrity** — PASS (2026-03-09, 7/10)
- [x] **Coach Scout — Exploration** — PASS (2026-03-22, 8/10). Streak: 2/3.
- [x] **Coach Scout — Graduation Exercise** — FAIL (2026-03-09, 7/14). Streak reset 0/3.
- [x] **Coach Coder — Full arc** — Ex2: PARTIAL → Ex2b: PASS → Ex2c: PASS → Graduation: PASS. **🎓 GRADUATED** (2026-03-24). Streak 3/3.
- [x] Infrastructure blocker (manager.hasAgent) — Resolved 2026-03-09.

## ✅ COMPLETED FOCUS ITEMS

- [x] "Coach doesn't do the agent's work" boundary — Made explicit in domain.md.
- [x] Periodic review of graduated agents — Designed regression review process.
- [x] Capability level assessment — All 10 agents assessed.
- [x] Graduation tracking — Created COACHEES.md.
- [x] COMMON.md evaluation — Selective adoption (2 adopted, 1 adapted, 3 rejected).
- [x] MAST evaluation — Selective adoption (3 adopted, 2 rejected).
- [x] Train coder on blind-overwrite — PASS.
- [x] Train QA on truncated-read — PARTIAL.
- [x] Train may/bob/optimizer on todo.md — Done via domain.md updates.
- [x] Train optimizer on journal.md — Done via domain.md update.

# Tracking

- ⚠️ Review session s_1772907291430_22 — **Task tree eval** of 5 agents. Systemic root cause: **identity confusion**. Amy selected as coaching target. Exercise designed and executed: FAIL (2026-03-22). Prompt fix escalated to Optimizer.
- ⚠️ Review session s_1772966696498_109 — Agent: **scout**. Root cause: **completion bias**. Exercise: PASS (2026-03-09, 7/10). **Graduation exercise FAIL** (2026-03-09, 7/14). Root cause: Agent + Design. Streak reset 0/3 → rebuilt to 2/3 via exploration PASS. Corrections applied. Re-test pending.
- ⚠️ Bob production regression (s_1773083559086_52) — q=0.2, 80 wasted calls, sed thrashing on heading text. Root cause: Agent (execution under ambiguity) + Infrastructure (token expiry). Coaching exercise #2 confirmed skill is present (10/10). Next: adversity exercise to test robustness.
- [x] Coder graduation exercise — PASS (2026-03-24, 10/10). Streak 3/3 → FIRST GRADUATION.
- [x] Coach Amy — PASS (2026-03-09). L1 confirmed. Pass streak: 1/3.
- [x] Coder exercise 2c — PASS (2026-03-23, 10/10). Hard mode passed.
- [x] Bob sed discipline #2 — PASS (2026-03-25, 10/10). Streak: 2/3. Production regression addressed.

## Evaluation Scan Results (2026-03-25)
- **1046 total evaluations** (+75 since last scan on 2026-03-22)
- New actionable evaluations:
  - Bob s_1773083559086_52: q=0.2, needs_improvement — sed thrashing, addressed via coaching exercise
  - Optimizer s_1773083423706_50: q=0.85, good — path hallucination recovered, minor
  - Coach s_1773078712214_8: q=0.45, acceptable — path failures (self-improvement item)
