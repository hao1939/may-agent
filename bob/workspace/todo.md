# Bob's Todo List

<!-- KEEP THIS FILE UNDER 50 LINES. Move completed items to todo-archive.md. -->

## Active / In Progress
- [x] **EXP-163 processed** — Ceiling effect invalidates H-161 test. Hidden-dep scenario: 100% product pass all arms. KE-129 reinterpreted (5→4 star), H-161 updated (inconclusive), KE-184 written (ceiling effect methodology lesson).
- [x] **Scenario Gap-Fill: 2 recognition scenarios** — Created + baselined. Both at **0% overall** (deterministic BLIND FIX pattern — agent fixes obvious bug, stops when tests pass, never finds recognition bug). 6 trials partial-migration, 5 trials type-mismatch. Good for intervention testing but NOT in 30-70% target range.
- [x] **Scenario Gap-Fill v2: 2 new recognition scenarios** — sql-injection-in-query-builder: **33% baseline (1/3)** ✅ IN TARGET RANGE. deprecation-warning-cleanup: **100% baseline (3/3)** ❌ too easy (warnings visible in output). See RECOGNITION-GAPFILL-BASELINE-RESULTS.md.
- [ ] **Scenario Gap-Fill** [MEDIUM]: sql-injection (33%) is ready for intervention experiments. deprecation-warning needs redesign (remove console.warn to make recognition harder) or replacement. Consider 1-2 more scenarios to increase portfolio.
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
