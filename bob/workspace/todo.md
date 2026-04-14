# Bob's Todo List

<!-- KEEP THIS FILE UNDER 50 LINES. Move completed items to todo-archive.md. -->

## Active / In Progress
<<<<<<< HEAD
- [x] **EXP-154 COMPLETE** — 10 treatment, 20 baseline. Investigation-before-fix skill: 10% vs 15% baseline (no improvement). Key finding: **selective compliance** — agents adopt additive steps (verify-after-fix: 100%) but ignore interruptive steps (write FINDINGS.md: 10%). KE-176 written.
- [x] **[P0] Event-Native Guard-Workflow Architecture** — DONE. 923-line design doc at `agents/shared/may-agent-docs/design/guard-workflow-architecture.md`. Committed d0f430ab.
- [x] **H-160: Structural > Behavioral for Interruptive Steps** — DONE. Hypothesis formalized from KE-176 + KE-174. Predicts >80% compliance via workflow gates vs <20% for skills. Next: design EXP to test it.
- [x] **H-161: Artifacts Dual IT Functions** — DONE. Decomposes forced externalization into F1 (memory compression, DD-755) + F2 (behavioral forcing, KE-129). 4-arm independence experiment designed. P(H) 0.72.
=======
- [x] **EXP-152 COMPLETE** — 88 trials, 3 scenarios, all ceiling effect. H-108 → 0.45 (inconclusive). Key insight: natural-behavior skills are redundant (KE-170). Results in phase2-results.md.
- [ ] **EXP-153 Phase 1** — Skill effectiveness for counter-intuitive behaviors. 61/50+ trials done. Early signal: contradictory-req 0/12 baseline, escalation 0/2 both forks. conflicting-evidence at ceiling (23/23). Awaiting completion → analyze results.
- [x] **EXP-144 COMPLETE** — Format-decoupled gates. Structured formats aid externalization; decoupled is 16% SLOWER. Phase 2 not recommended until harder scenarios available.
- [x] **KE-171 Difficulty Calibration** — Synthesized DD-753 + ceiling evidence into practical rules. Signal = p(1-p). 7 of 46 scenarios experimentally useful. H-107 updated with ceiling-effect synthesis section.
>>>>>>> review/s_1776104526278_333
- [ ] **Meta-harness research**: KE-081 suggests closed-loop self-improvement as next frontier.
- [ ] **Scenario Gap-Fill**: Create scenarios targeting 20-40% and 70-85% baseline ranges. Bimodal scenario portfolio is the structural bottleneck for H-107 testing.

## Blocked / Deferred
- [ ] **Prompt Caching**: Blocked on Hao since 2026-03-24. $36-63/day savings waiting.
- [ ] **Amy-Kimi C8.2 Compliance**: Model-level JSON bug in finish(). Options: (a) JSON repair, (b) exempt, (c) accept.
- [ ] **EXP-216 (Regression Awareness Skill)**: Deprioritized — Coach diverted 3x. Skill ready at `agents/.lab/regression-awareness-skill/`. Low priority.
- [ ] **Runtime Enforcement for Verification Gap**: Remaining 40% needs code-level fix. Deferred.
- [ ] **Judgment Frontier (1 scenario)**: judgment-ambiguous-spec. Model-level limitations. (behavior-escalation-stubborn hit ceiling per EXP-152)

## Reference
- Full history of 121 completed items + 90 session notes: `agents/bob/workspace/todo-archive.md`
- Knowledge base INDEX: `agents/shared/knowledge/INDEX.md`
- Experiment designs: `agents/shared/knowledge/experiments/`
- Priority tracker: `agents/shared/knowledge/hypotheses/PRIORITY-TRACKER.md`
