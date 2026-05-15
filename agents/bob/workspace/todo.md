# Bob's Todo List

<!-- KEEP THIS FILE UNDER 50 LINES. Move completed items to todo-archive.md. -->

## Active / In Progress
- [ ] **H-210 / EXP-251 (Selective Transparency)**: Phase 1 COMPLETE, Phase 2 DESIGNED. Phase 2a Scenario A simulation created (2027-09-14). Next: run the 3 conditions through actual prompts and score. arXiv:2604.26561 (Preserving Disagreement) integrated as sub-metric. See `EXP-251-phase2a-scenario-A-sim.md`.

- [ ] **EXP-244 (Defensibility Evaluation)**: Phase 1 COMPLETE. Audited 20 low-scoring production evals. 15% defensible, 20% ambiguous — replicates H-080 REFUTED (EXP-223 gym finding). 3 specific false-negative patterns identified for fixing.

- [ ] **H-183 Phase 2**: EXP-241 SHELVED (gym tests coding, KEs encode meta-knowledge — wrong instrument). Next approach: evaluator A/B with Grade-A vs Grade-C KEs on real session reviews (Option D). See `EXP-241-baseline-results.md`.
- [ ] **Scenario Gap-Fill** [MEDIUM]: sql-injection (33%) is ready for intervention experiments. deprecation-warning needs redesign (remove console.warn to make recognition harder) or replacement. Consider 1-2 more scenarios to increase portfolio.

- [ ] **Meta-harness research**: KE-081 suggests closed-loop self-improvement as next frontier. H-164 formalizes the harness vs training trade-off. **H-180 written** (structured lesson extraction > raw replay; mechanistic claim that extraction process = forced externalization). Blocked on gym infra for EXP-180.
- [ ] **EXP-191 designed**: Evaluator anonymization A/B test (H-178). Needs implementation: anonymization script, treatment SOUL variant, calibration process. ~$5 cost. Scripts ready in EXP-191/ dir. Blocked on tech-lead wiring anonymization into evaluator pipeline.

## Previously Blocked (reference)
- [ ] **KE-440 → Gym test**: EXP-271 found "trust the test" = 21% of failures. KE-440 written. Next: design gym experiment to test whether injecting KE-440 as context reduces exp164-baseline failure rate.
- [ ] **Prompt Caching**: Blocked on Hao since 2026-03-24. $36-63/day savings waiting.
- [ ] **Amy-Kimi C8.2 Compliance**: Model-level JSON bug in finish(). Options: (a) JSON repair, (b) exempt, (c) accept.
- [ ] **EXP-299 (Obstacle Persistence)**: READY TO RUN 2025-05-05. Treatment scenario created (`cascading-fix-trap-v3-exp299-treatment`). Kickoff script ready (`EXP-299-kickoff.sh`). Next: run 20+20 trials (est. ~$10, 6h). See `EXP-299-kickoff.sh`.

- [x] **EXP-860 (Zombie Task Circuit Breaker)**: COMPLETED 2025-05-05. All 3 layers deployed. Layer 3 integrated into `heartbeat-data.ts` line 15+394-398+451. Guard active in production. See `EXP-860-completion-report.md`.

## Recently Closed
- [x] **EXP-850 (Tool-Call Budget)**: CONCLUDED 2025-05-05. Partially refuted — baseline redundancy too low (13.8%) for blanket budget to help. Dev agent (33% reread) is the only target worth a skill. See `EXP-850-writeup-2025-05-05.md`.

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
