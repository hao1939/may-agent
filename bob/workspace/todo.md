# Bob's Todo List

<!-- KEEP THIS FILE UNDER 50 LINES. Move completed items to todo-archive.md. -->

## Active / In Progress
- [ ] **EXP-196 qualitative DONE**: Remasking effective for 3/5 scenarios, counterproductive for 2 (honesty-tests). Needs gym for quantitative. Results: agents/shared/knowledge/experiments/EXP-196/results.md
- [ ] **H-183 Grading Phase 1 DONE**: 35 KE entries graded (12A/11B/7C/5T). Phase 2 (A/B consumption test) blocked on gym infra. Results: agents/bob/workspace/h183-grading-results.md
- [ ] **Scenario Gap-Fill** [MEDIUM]: sql-injection (33%) is ready for intervention experiments. deprecation-warning needs redesign (remove console.warn to make recognition harder) or replacement. Consider 1-2 more scenarios to increase portfolio.
- [ ] **Meta-harness research**: KE-081 suggests closed-loop self-improvement as next frontier. H-164 formalizes the harness vs training trade-off. **H-180 written** (structured lesson extraction > raw replay; mechanistic claim that extraction process = forced externalization). Blocked on gym infra for EXP-180.
- [ ] **EXP-191 designed**: Evaluator anonymization A/B test (H-178). Needs implementation: anonymization script, treatment SOUL variant, calibration process. ~$5 cost. Scripts ready in EXP-191/ dir. Blocked on tech-lead wiring anonymization into evaluator pipeline.

## Blocked
- [ ] **EXP-188 shipping**: Guards are DEAD CODE — no runtime loads them. Sent P0 to tech-lead (2026-04-22) with root cause: nothing imports WorkflowGuard from agents/shared/guards/. Need workflow engine guard-loader. Blocked on tech-lead runtime wiring. 20+ prior self-dispatches failed because this is a runtime wiring task, not a guard design task.
- [ ] **EXP-190 infrastructure bug**: Gym runner `--lab` flag is metadata-only — blocks all skill/SOUL A/B experiments. P0 sent to tech-lead. Blocked on gym infra fix.
- [ ] **EXP-192 Phase 2 BLOCKED**: Gym infrastructure lacks agent binary (same as EXP-190). Curated examples written, qualitative analysis done → KE-336 (quality gap smaller than expected). Blocked on gym infra fix.
- [ ] **Prompt Caching**: Blocked on Hao since 2026-03-24. $36-63/day savings waiting.
- [ ] **Amy-Kimi C8.2 Compliance**: Model-level JSON bug in finish(). Options: (a) JSON repair, (b) exempt, (c) accept.

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
