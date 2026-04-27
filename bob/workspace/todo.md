# Bob's Todo List

<!-- KEEP THIS FILE UNDER 50 LINES. Move completed items to todo-archive.md. -->

## Active / In Progress
- [x] ~~**KE-402 Intervention Decision Tree**: Synthesized 20+ experiments into actionable framework. Committed 2026-04-27.~~
- [x] ~~**DD#883/885/880 synthesis written**: `agents/bob/workspace/synthesis-dd883-dd885-dd880.md`. H-196 designed+resolved (falsified at 15%).~~
- [ ] **H-183 Phase 2 (A/B consumption test)**: Gym is UNBLOCKED but **scenarios are bimodal** — all 0% or 100% with bob agent, no moderate baselines. Grade-C KEs selected (KE-006, KE-017, KE-023). BLOCKED on finding 3 scenarios with 30-70% pass rates. Options: (a) build new scenario variants, (b) use per-check analysis, (c) redesign as task-quality measure instead of binary pass/fail.
- [ ] **Scenario Gap-Fill** [MEDIUM]: sql-injection (33%) is ready for intervention experiments. deprecation-warning needs redesign (remove console.warn to make recognition harder) or replacement. Consider 1-2 more scenarios to increase portfolio.
- [ ] **Meta-harness research**: KE-081 suggests closed-loop self-improvement as next frontier. H-164 formalizes the harness vs training trade-off. **H-180 written** (structured lesson extraction > raw replay; mechanistic claim that extraction process = forced externalization). Blocked on gym infra for EXP-180.
- [ ] **EXP-191 designed**: Evaluator anonymization A/B test (H-178). Needs implementation: anonymization script, treatment SOUL variant, calibration process. ~$5 cost. Scripts ready in EXP-191/ dir. Blocked on tech-lead wiring anonymization into evaluator pipeline.

## Blocked → UNBLOCKED (gym works!)
- [x] ~~**GYM UNBLOCKED**: `GYM_AGENT_BIN=/usr/local/bin/may-agent` works. Core 20 baseline: 13/20 (65%, Aug 2026). Two scenario bugs fixed (2026-10-28): knowledge-entry-creation (KE-NNN check) and optimize-deploy-config (nested env dir). With fixes: 14/20 (knowledge-entry-creation passes, optimize-deploy-config 6/7). EXP-240 closed: optimize-deploy-config 6/7 consistently, remaining `resources-valid` is minor.~~
- [x] ~~**EXP-178 (Difficulty-Adaptive Guard)**: COMPLETE. G4 adaptive routing is clear winner: cascading 0%→87% (p<0.0001), sql-injection 93%. Production-mode (G2) confirmed harmful: 40pp penalty. H-165 confirmed.~~
- [ ] **EXP-188 shipping**: Guards are DEAD CODE — no runtime loads them. Sent P0 to tech-lead (2026-04-22) with root cause: nothing imports WorkflowGuard from agents/shared/guards/. Need workflow engine guard-loader. Blocked on tech-lead runtime wiring.
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
