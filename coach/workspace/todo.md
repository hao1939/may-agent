# TODO

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

- [x] [STALE] - Review session s_1773034599260_181 (verdict: needs_improvement). Check .state/evaluations/ for details. Identify which agent needs coaching and run a targeted exercise.
- [x] [STALE] - Review session s_1772903691430_14 (verdict: needs_improvement). Check .state/evaluations/ for details. Identify which agent needs coaching and run a targeted exercise.
## ✅ INFRASTRUCTURE BLOCKER — RESOLVED (2026-03-09)
- `manager.hasAgent` error no longer occurring. Bob coaching session s_1773045938983_232 ran successfully via subagents.delegate.
- Bob safe-edit exercise: EXECUTED and PASSED.

## 🔴 FOCUS — TOP PRIORITY

- [x] **Coach Amy — Identity Resolution** — FAIL (2026-03-22). Amy identified as May. Report: sessions/amy-identity-exercise-2026-03-22.md
- [x] **Coach Bob — Safe-Edit Discipline** — PASS (2026-03-09). Score: 8/10. Report: sessions/bob-safe-edit-2026-03-09.md
- [x] **Coach Scout — Constrained-Source Integrity** — PASS (2026-03-09). Score: 7/10 (borderline). Date verification ✅, fail-fast ✅, confidence labeling ✅ (exemplary), source failure reporting ⚠️ (partial), knowledge file consultation ❌. Report: sessions/scout-coaching-2026-03-09.md
- [x] **Coach Scout** — Covered by exploration exercise PASS (2026-03-22) + constrained-source PASS (2026-03-09). Pass streak: 2/3.
- [x] **Coach Scout — Graduation Exercise** — **FAIL** (2026-03-09). Score: 7/14. Hard fail on knowledge file paths (3rd consecutive occurrence). Pass streak RESET to 0/3. Report: sessions/scout-graduation-2026-03-09.md
- [🔴] **Optimizer: Apply Scout coaching corrections — BLOCKING** — Add lessons #11 (knowledge file paths), #12 (explicit source failure reporting), #13 (write scope paths) to `agents/scout/knowledge/coaching.md`. Also fix DOMAIN.md path ambiguity (`knowledge/discoveries.md` → `agents/scout/knowledge/discoveries.md`). **Scout cannot graduate until this is done.** Scout is L2, coach should not edit directly.
- [ ] **Coach Scout — Re-test after corrections** — Re-run graduation exercise after optimizer applies corrections. If PASS, streak is 1/3 (not graduation — streak was reset).
- [x] **Coach Coder — Safe-Edit Usage** — PARTIAL→PASS. Ex2: PARTIAL (6.5/10, 2026-03-09). Ex2b: PASS (9/10, 2026-03-22). Pattern-only prompts fixed the issue. Streak: 1/3.
- [x] **Coach Coder — Exercise 2b (pattern-only prompts)** — PASS (2026-03-22, 9/10). All 4 edits pattern-based. Hypothesis confirmed: line numbers in prompt cue line-number sed. Report: sessions/coder-safe-edit-2b-2026-03-22.md
- [ ] **Coach Coder — Exercise 2c (hard mode)** — Multi-site edit WITH line numbers in prompt but explicit instruction to use pattern-based sed. Tests whether lesson is internalized vs just environmental.
- [ ] **Coach Amy-Kimi** — Same exploration cycle exercise as Amy. Verify tool failure handling, actionable insights, frequency discipline, archive synthesis.
- [ ] **Amy exercise 2** — L2 assessment: ambiguous/self-directed task. Open-ended exploration prompt, see if Amy can self-direct.
- [ ] **Amy live search validation** — When XHS access is restored, re-run full search→read→archive pipeline.

# Tracking

- ⚠️ Review session s_1772907291430_22 — **Task tree eval** of 5 agents. Systemic root cause: **identity confusion**. Amy selected as coaching target. Exercise designed and executed: FAIL (2026-03-22). Prompt fix escalated to Optimizer.
- ⚠️ Review session s_1772966696498_109 — Agent: **scout**. Verdict: **needs_improvement** (q=0.25). Root cause: **completion bias**. Exercise designed and executed: **PASS** (2026-03-09, 7/10). 3 of 4 failure modes improved; knowledge file path resolution still failing. **Graduation exercise FAIL** (2026-03-09, 7/14). Root cause: Agent (path hallucination) + Design (coaching corrections never applied). Streak reset 0/3.
- ⚠️ Review session s_1772910891442_34 — Coach self-eval. Bob coaching exercise designed and executed: PASS (2026-03-09).
- ⚠️ Coder safe-edit exercise 2 — PARTIAL (2026-03-09). Line-number sed habit persists despite lessons.md ban. Hypothesis: line numbers in task prompt cue the behavior. Next test: pattern-only prompts.
- [x] Coach Amy — PASS (2026-03-09). L1 confirmed. Pass streak: 1/3.
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
