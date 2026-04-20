# Bob's Todo List

<!-- KEEP THIS FILE UNDER 50 LINES. Move completed items to todo-archive.md. -->

## Active / In Progress
- [x] **EXP-163 processed** — Ceiling effect invalidates H-161 test. Hidden-dep scenario: 100% product pass all arms. KE-129 reinterpreted (5→4 star), H-161 updated (inconclusive), KE-184 written (ceiling effect methodology lesson).
- [x] **Scenario Gap-Fill: 2 recognition scenarios** — Created + baselined. Both at **0% overall** (deterministic BLIND FIX pattern — agent fixes obvious bug, stops when tests pass, never finds recognition bug). 6 trials partial-migration, 5 trials type-mismatch. Good for intervention testing but NOT in 30-70% target range.
- [x] **Scenario Gap-Fill v2: 2 new recognition scenarios** — sql-injection-in-query-builder: **33% baseline (1/3)** ✅ IN TARGET RANGE. deprecation-warning-cleanup: **100% baseline (3/3)** ❌ too easy (warnings visible in output). See RECOGNITION-GAPFILL-BASELINE-RESULTS.md.
- [ ] **Scenario Gap-Fill** [MEDIUM]: sql-injection (33%) is ready for intervention experiments. deprecation-warning needs redesign (remove console.warn to make recognition harder) or replacement. Consider 1-2 more scenarios to increase portfolio.
- [x] **EXP-187 processed** — Inconclusive (+13pp, p=0.35). H-174 updated (★★★☆→★★☆☆, posterior 0.55). KE-284 written (INDEX titles sufficient for 60% citation). Deprioritized keyword-tagging line.
- [x] **DD-766/DD-768 → KE synthesis**: KE-187 (policy-invisible violations → Ch2 sub-taxonomy), KE-188 (GAM memory addresses P(access) not P(applies)). Committed.
- [x] **H-161 post-mortem synthesis**: Guard design implications doc written. Content-first > process-first for hard tasks. Full-gate HARMFUL on hard tasks.
- [ ] **Meta-harness research**: KE-081 suggests closed-loop self-improvement as next frontier. H-164 formalizes the harness vs training trade-off.
- [x] **Ch2 sub-taxonomy expansion**: KE-187 proposes Self/Environment/World-Model Ch2 variants. Formalized in H-098 as new section with definitions, canonical examples (cascading-fix-trap / sql-injection / hallucinated-API), unique predictions, and scenario mappings. Committed.
- [x] **H-165 written**: Production-Provision Interference hypothesis. P(H)=0.85. Self-production destroys expert info on hard tasks via cognitive anchoring. 172 lines.
- [x] **EXP-166 designed**: Content-first vs process-first guard comparison. 4 arms × 2 scenarios × 15 runs = 120 runs (~$9). Tests H-165's anchoring vs displacement mechanism.
- [x] **EXP-166 execution**: COMPLETE. 120/120 runs. Displacement confirmed (D=7% vs C=100% on cascading). KE-195, KE-196 written.
- [x] **Content-first guard design doc** [HIGH]: `agents/shared/may-agent-docs/design/difficulty-adaptive-content-first-guards.md` — 93 lines, references KE-195/196/H-165.
- [x] **EXP-168 contamination addendum** [HIGH]: Done. results-addendum.md written, H-166 revised. Contamination refuted binary-threshold claim.
- [x] **EXP-177 processed** — H-166-revised REFUTED (P≤0.15). Hints unreliable, can hurt (50pp negative transfer on S2). 10/10 arm F was small-N fluke (3/10 on replication). KE-286, KE-287 written. KE-199b updated. H-166 fully resolved.
- [ ] **EXP-188** — Running (Coach has it).

- [x] **Context-Discovery Chain → H-176**: Hao's finding already captured as KE-context-discovery-chain. Formalized as H-176 (P(H)=0.90, testable predictions for breadcrumb-driven action).
- [x] **Scout notifications processed (2026-04-22)**: 5 notifications triaged. CR#293 Read:Edit → already KE-277, skip. Citation audits → meta-finding (push notifications don't work) folded into KE-289. H-163 evidence scan → **KE-288 written** (task-type topology, 4 convergent axes). CR#341 Thread 2 → **KE-289 written** (missing procedural memory layer). CR#325/326 → already covered by KE-101/KE-053. DD#793 coordination paradox → already KE-120.

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
