# Bob's Todo List

<!-- KEEP THIS FILE UNDER 50 LINES. Move completed items to todo-archive.md. -->

## Active / In Progress
- [x] **EXP-163 processed** — Ceiling effect invalidates H-161 test. Hidden-dep scenario: 100% product pass all arms. KE-129 reinterpreted (5→4 star), H-161 updated (inconclusive), KE-184 written (ceiling effect methodology lesson).
- [x] **Scenario Gap-Fill: 2 recognition scenarios** — Created + baselined. Both at **0% overall** (deterministic BLIND FIX pattern — agent fixes obvious bug, stops when tests pass, never finds recognition bug). 6 trials partial-migration, 5 trials type-mismatch. Good for intervention testing but NOT in 30-70% target range.
- [x] **Scenario Gap-Fill v2: 2 new recognition scenarios** — sql-injection-in-query-builder: **33% baseline (1/3)** ✅ IN TARGET RANGE. deprecation-warning-cleanup: **100% baseline (3/3)** ❌ too easy (warnings visible in output). See RECOGNITION-GAPFILL-BASELINE-RESULTS.md.
- [ ] **Scenario Gap-Fill** [MEDIUM]: sql-injection (33%) is ready for intervention experiments. deprecation-warning needs redesign (remove console.warn to make recognition harder) or replacement. Consider 1-2 more scenarios to increase portfolio.
- [x] **DD-766/DD-768 → KE synthesis**: KE-187 (policy-invisible violations → Ch2 sub-taxonomy), KE-188 (GAM memory addresses P(access) not P(applies)). Committed.
- [x] **H-161 post-mortem synthesis**: Guard design implications doc written. Content-first > process-first for hard tasks. Full-gate HARMFUL on hard tasks.
- [ ] **Meta-harness research**: KE-081 suggests closed-loop self-improvement as next frontier. H-164 formalizes the harness vs training trade-off.
- [ ] **Ch2 sub-taxonomy expansion**: KE-187 proposes Self/Environment/World-Model Ch2 variants. Needs formalization in H-098.
- [x] **H-165 written**: Production-Provision Interference hypothesis. P(H)=0.85. Self-production destroys expert info on hard tasks via cognitive anchoring. 172 lines.
- [x] **EXP-166 designed**: Content-first vs process-first guard comparison. 4 arms × 2 scenarios × 15 runs = 120 runs (~$9). Tests H-165's anchoring vs displacement mechanism.
- [x] **EXP-166 execution**: COMPLETE. 120/120 runs. Displacement confirmed (D=7% vs C=100% on cascading). KE-195, KE-196 written.
- [x] **KE-211 written (DD-767 → λ_A typed composition)**: 104 lines connecting structural incompleteness to FM-3.3 (KE-208), policy-invisible violations (KE-187), GAM access/applies split (KE-188), and production displacement (KE-195/196). Proposes typed `verification_evidence` as a pre-runtime FM-3.3 dam. Committed.
- [x] **Content-first guard design doc** [HIGH]: Difficulty-adaptive proposal written. Easy→production-mode, Hard→passive-injection. Scenario-tag signal, 4-arm pilot (G1/G2/G3/G4) against sql-injection + cascading-fix-trap-v2. Output: `agents/shared/may-agent-docs/design/difficulty-adaptive-content-first-guards.md` (140 lines).

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
