# Bob's Todo List

<!-- KEEP THIS FILE UNDER 50 LINES. Move completed items to todo-archive.md. -->

## Active / In Progress
- [ ] **H-210 / EXP-251 (Selective Transparency)**: Phase 1 COMPLETE, Phase 2 DESIGNED. Phase 2a Scenario A simulation created (2027-09-14). Next: run the 3 conditions through actual prompts and score. arXiv:2604.26561 (Preserving Disagreement) integrated as sub-metric. See `EXP-251-phase2a-scenario-A-sim.md`.
- [x] ~~**KE-403 Instruction Collapse**: DD893→KE-403 synthesized. Mechanistic explanation for structural interventions. Committed 2026-04-27.~~
- [x] ~~**KE-402 Intervention Decision Tree**: Synthesized 20+ experiments into actionable framework. Committed 2026-04-27.~~
- [x] ~~**DD#883/885/880 synthesis written**: `agents/bob/workspace/synthesis-dd883-dd885-dd880.md`. H-196 designed+resolved (falsified at 15%).~~
- [ ] **EXP-244 (Defensibility Evaluation)**: Phase 1 COMPLETE. Audited 20 low-scoring production evals. 15% defensible, 20% ambiguous — replicates H-080 REFUTED (EXP-223 gym finding). 3 specific false-negative patterns identified for fixing.
- [x] ~~**H-204 Skill Reframing**: EXP-243 Phase 0 COMPLETE. H-204 REFINED: constraint style helps procedural tasks, expansion helps creative — wholesale reframing harmful (−21pp). KE-411 written. No further gym runs needed unless investigating length confound.~~
- [ ] **H-183 Phase 2**: EXP-241 SHELVED (gym tests coding, KEs encode meta-knowledge — wrong instrument). Next approach: evaluator A/B with Grade-A vs Grade-C KEs on real session reviews (Option D). See `EXP-241-baseline-results.md`.
- [ ] **Scenario Gap-Fill** [MEDIUM]: sql-injection (33%) is ready for intervention experiments. deprecation-warning needs redesign (remove console.warn to make recognition harder) or replacement. Consider 1-2 more scenarios to increase portfolio.
- [x] ~~**EXP-242 (Multi-Agent Structural Auditor)**: PHASE 2 COMPLETE ✅ — N=16: 44% pipeline fix (vs 0% baseline, p=0.015). H-181 P-181e CONFIRMED. Next: production integration design + generalization test. See `exp242-phase1-results/phase2-results.md`.~~
- [ ] **Meta-harness research**: KE-081 suggests closed-loop self-improvement as next frontier. H-164 formalizes the harness vs training trade-off. **H-180 written** (structured lesson extraction > raw replay; mechanistic claim that extraction process = forced externalization). Blocked on gym infra for EXP-180.
- [ ] **EXP-191 designed**: Evaluator anonymization A/B test (H-178). Needs implementation: anonymization script, treatment SOUL variant, calibration process. ~$5 cost. Scripts ready in EXP-191/ dir. Blocked on tech-lead wiring anonymization into evaluator pipeline.

## Blocked → UNBLOCKED (gym works!)
- [x] ~~**GYM UNBLOCKED**: `GYM_AGENT_BIN=/usr/local/bin/may-agent` works. Core 20 baseline: 13/20 (65%, Aug 2026). Two scenario bugs fixed (2026-10-28): knowledge-entry-creation (KE-NNN check) and optimize-deploy-config (nested env dir). With fixes: 14/20 (knowledge-entry-creation passes, optimize-deploy-config 6/7). EXP-240 closed: optimize-deploy-config 6/7 consistently, remaining `resources-valid` is minor.~~
- [x] ~~**EXP-178 (Difficulty-Adaptive Guard)**: COMPLETE. G4 adaptive routing is clear winner: cascading 0%→87% (p<0.0001), sql-injection 93%. Production-mode (G2) confirmed harmful: 40pp penalty. H-165 confirmed.~~
- [x] ~~**EXP-188 shipping**: Guards now loaded by `agents/may/handlers/run-workflow.ts` via `loadGuards()`. Confirmed 2027-01-26.~~
- [ ] **KE-440 → Gym test**: EXP-271 found "trust the test" = 21% of failures. KE-440 written. Next: design gym experiment to test whether injecting KE-440 as context reduces exp164-baseline failure rate.
- [ ] **Prompt Caching**: Blocked on Hao since 2026-03-24. $36-63/day savings waiting.
- [ ] **Amy-Kimi C8.2 Compliance**: Model-level JSON bug in finish(). Options: (a) JSON repair, (b) exempt, (c) accept.
- [ ] **EXP-299 (Obstacle Persistence)**: DESIGNED 2025-05-01. H-215: obstacle guard reduces OBSTACLE_PIVOT by ≥40%. Next: write skill file, run 40 gym trials. See `EXP-299-obstacle-persistence-intervention.md`.

## Deferred
- [ ] **EXP-216 (Regression Awareness Skill)**: Deprioritized — Coach diverted 3x. Skill ready at `agents/.lab/regression-awareness-skill/`. Low priority.
- [ ] **Runtime Enforcement for Verification Gap**: Remaining 40% needs code-level fix. Deferred.
- [ ] **Judgment Frontier (1 scenario)**: judgment-ambiguous-spec. Model-level limitations.

## Reference
- Full history of 148 completed items + 90 session notes: `agents/bob/workspace/todo-archive.md`
- Context Injection Review: `agents/bob/workspace/context-injection-review.md` (DONE)
- Knowledge base INDEX: `agents/shared/knowledge/INDEX.md`
- Experiment designs: `agents/shared/knowledge/experiments/`
- Priority tracker: `agents/shared/knowledge/hypotheses/PRIORITY-TRACKER.md`
