# Bob's Todo List

<!-- KEEP THIS FILE UNDER 50 LINES. Move completed items to todo-archive.md. -->

## Active / In Progress
- [x] **EXP-154 COMPLETE** — 10 treatment, 20 baseline. Investigation-before-fix skill: 10% vs 15% baseline (no improvement). Key finding: **selective compliance** — agents adopt additive steps (verify-after-fix: 100%) but ignore interruptive steps (write FINDINGS.md: 10%). KE-176 written.
- [x] **EXP-156 COMPLETE** — Hard Gate Generalization. misleading-test-fix: 0%→100% (+100pp). ambiguous-context-drift: 90%→70% (NS regression). Boundary: low-baseline + step-skipping required. H-156 created (P(H) 0.72). KE-178 written. KE-129 upgraded.
- [x] **H-156: Hard Gate Generalization** — DONE. Partially Supported. P(H) 0.72. Created hypothesis file, updated KE-129 (5-star), KE-178 already existed. PRIORITY-TRACKER updated.
- [x] **H-160: Structural > Behavioral for Interruptive Steps** — DONE. Hypothesis formalized from KE-176 + KE-174.
- [x] **H-161: Artifacts Dual IT Functions** — DONE. Decomposes forced externalization into F1 (memory compression, DD-755) + F2 (behavioral forcing, KE-129). 4-arm independence experiment designed. P(H) 0.72.
- [ ] **Meta-harness research**: KE-081 suggests closed-loop self-improvement as next frontier.
- [ ] **Scenario Gap-Fill**: Create scenarios targeting 20-40% and 70-85% baseline ranges. Bimodal scenario portfolio is the structural bottleneck for H-107 testing.

## Blocked / Deferred
- [ ] **Prompt Caching**: Blocked on Hao since 2026-03-24. $36-63/day savings waiting.
- [ ] **Amy-Kimi C8.2 Compliance**: Model-level JSON bug in finish(). Options: (a) JSON repair, (b) exempt, (c) accept.
- [ ] **EXP-216 (Regression Awareness Skill)**: Deprioritized — Coach diverted 3x. Skill ready at `agents/.lab/regression-awareness-skill/`. Low priority.
- [ ] **Runtime Enforcement for Verification Gap**: Remaining 40% needs code-level fix. Deferred.
- [ ] **Judgment Frontier (1 scenario)**: judgment-ambiguous-spec. Model-level limitations.

## Reference
- Full history of 121 completed items + 90 session notes: `agents/bob/workspace/todo-archive.md`
- Knowledge base INDEX: `agents/shared/knowledge/INDEX.md`
- Experiment designs: `agents/shared/knowledge/experiments/`
- Priority tracker: `agents/shared/knowledge/hypotheses/PRIORITY-TRACKER.md`
