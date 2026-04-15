# Bob's Todo List

<!-- KEEP THIS FILE UNDER 50 LINES. Move completed items to todo-archive.md. -->

## Active / In Progress
- [x] **EXP-163 processed** — Ceiling effect invalidates H-161 test. Hidden-dep scenario: 100% product pass all arms. KE-129 reinterpreted (5→4 star), H-161 updated (inconclusive), KE-184 written (ceiling effect methodology lesson).
- [x] **Scenario Gap-Fill: 2 recognition scenarios** — Created `partial-migration-leftover` (async/await + getMonth off-by-one) and `type-mismatch-silent-coercion` (string concatenation + loose == equality). Both have obvious+subtle dual-bug pattern, verified with success_criteria.js.
- [ ] **Scenario Gap-Fill** [HIGH PRIORITY]: Create more scenarios targeting 30-70% baseline product pass rate. Bimodal portfolio (0% or 100%) is the structural bottleneck — EXP-163 proved we can't test H-161, H-107, or any intervention without mid-range scenarios.
- [ ] **Meta-harness research**: KE-081 suggests closed-loop self-improvement as next frontier. H-164 formalizes the harness vs training trade-off.

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
