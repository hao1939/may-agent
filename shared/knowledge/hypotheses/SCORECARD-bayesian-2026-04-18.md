# Bayesian Hypothesis Scorecard — Sixth Pass

**Date**: 2026-04-18
**Author**: Bob (Architect)
**Supersedes**: SCORECARD-bayesian-2026-04-16.md
**Method**: Manual Bayesian scoring, evidence-quality weighted. Anchor calibration unchanged (ground-truth gym 0.8, literature 0.4, cross-refs 0.15, pure theory 0.05).

## Purpose

Two days after the fifth-pass scorecard, three structural changes require a rebalance:

1. **H-167 (Typed-Contract Discriminability) is born** with a fourth evidence pillar (DD-767 / KE-211 — λ_A typed composition, Coq-mechanized, 835-config field study). Active at **P(H)=0.73**.
2. **H-166's mechanism has changed**: EXP-173 + post-contamination controls refuted the *high-threshold* (complete-expert-analysis-required) model. The revised *low-threshold causal-pointer* model is captured in **KE-199b** (replaces deprecated KE-199). H-166 is now split across two propositions — the original collapses, the revised model holds pending EXP-177.
3. **H-165 (Production-Provision Interference)** has strengthened: EXP-166's 93pp displacement was confirmed on cascading-fix-trap, EXP-179 is designed (difficulty-adaptive guard validation), and the passive-injection corollary is now the default design stance.

No new hypotheses are introduced in this pass. Scope: rescoring + triad analysis + "next decisive evidence" column.

## Decision Thresholds (unchanged)

- ≥0.70 → Rely on it
- 0.50–0.69 → Active research
- 0.30–0.49 → Deprioritize
- <0.30 → Archive

---

## Tier 1: High Confidence (P(H) ≥ 0.70)

| # | Hypothesis | P(H) | Δ from Apr-16 | Key change since Apr-16 | Next decisive evidence |
|---|-----------|:----:|:---:|---|---|
| H-089 | Environmental evidence discovery closes absent-information gaps | **0.94** ✅ RESOLVED | ±0.00 | ✅ RESOLVED | Resolution verdict written 2026-04-18. EXP-079/080/083/098 cross-domain 0%→100% vs EXP-078 externalization 0% — orthogonality to H-085 established. P2 (evidence-type ranking) and P3 (independence on present-but-wrong) remain UNTESTED but are refinements, not blockers. |
| H-091 | Skill delivery methods — few-shot / checklists produce measurable change | **0.93** | ±0.00 | — | Rare-transfer failure on unmatched-domain scenarios. |
| H-099 | Discovery Task Boundary — discovery resists all external interventions | **0.90** ✅ RESOLVED | ±0.00 | ✅ RESOLVED | Resolution verdict written 2026-04-18. 7 experiments (N=84), all 3 channels exhausted + Einstellung external validation. Post-resolution refutation trigger: any +30pp intervention on a genuine discovery scenario. |
| H-095 | Agent-specific failure interventions > universal | **0.88** | ±0.00 | — | Bob FM-2.6 targeted guard vs universal guard A/B. |
| H-053 | Workflow adoption decays without structural reinforcement | **0.88** | ±0.00 | — | 30-day post-deployment adoption curve. |
| H-058 | Frustration → topology rewrite; forced assessment prevents it | **0.87** | ±0.00 | — | Replication in a second agent archetype. |
| H-098 | Attention Channel Theory — channel separation gates effectiveness | **0.83** | ±0.00 | H-167 refines (intra-Ch2 variance) but does not contradict. | P-167a (schema-checked vs bare Ch2 gate) result. |
| H-043 | Knowledge utilization: U = P(access) × P(applies) × P(helps) | **0.85** | ±0.00 | — | — |
| H-009 | Evaluator was a rubber stamp (mitigated) | **0.85** | ±0.00 | — | — |
| H-055 | Self-improvement bias: cosmetic over substantive | **0.82** | ±0.00 | — | Longitudinal self-mod audit. |
| H-088 | Implementation commitment closes analysis-action gap | **0.80** | ±0.00 | — | — |
| H-161 | Artifacts serve dual IT functions (F1 memory / F2 forcing, separable) | **0.80** | ±0.00 | Unchanged — KE-199b update lives in H-166, not here. | Production deployment of F1-only guard. |
| H-101 | Architectural readiness → guard internalization | **0.78** | ±0.00 | — | EXP-139 results. |
| H-160 | Structural enforcement > behavioral signaling (interruptive steps) | **0.94** ✅ RESOLVED | +0.16 | ✅ RESOLVED | Resolution verdict written 2026-04-18. EXP-155 + KE-212 decisive. |
| H-165 | **Production-Provision Interference** (displacement on hard tasks) | **0.80** | **+0.02** | EXP-166 displacement replicated cleanly (93pp gap on cascading-fix-trap, post-contamination). EXP-179 designed — tests difficulty-adaptive content-first guard. Passive-injection corollary is now the ambient design stance. | **EXP-179** results: if content-first guard ≥ 70% on hard scenarios AND ≤ baseline on easy scenarios → P(H) → 0.88. If null across difficulty → drop to 0.65. |
| H-085 | Forced externalization is the general mechanism | **0.75** | ±0.00 | Mechanism refinement from Apr-16 holds: F1 is the active ingredient, not F2. | — |
| H-054 | LLM judges have fundamental accuracy limits | **0.75** | ±0.00 | — | — |
| H-105 | Three-Layer Reasoning (execution / recognition / discovery) | **0.75** | ±0.00 | H-167's intra-Ch2 decomposition is compatible (Ch2 subtyping aligns with recognition-layer contracts). | EXP-146 unblocked. |
| H-167 | **Typed-Contract Discriminability modulates Ch2 effectiveness** | **0.73** | **NEW (carried from PRIORITY-TRACKER)** | Fourth evidence pillar added 2026-04-18: DD-767 / KE-211 (λ_A typed calculus, Coq-mechanized, 835-config field study, YAML-only 54% → YAML+AST 96–100% lint precision). Independent from memory/validator pillars; operates at composition layer. +0.03 from prior entry into tracker. | **P-167a** (schema-checked vs bare file-existence Ch2 gate on cascading-fix-trap, N=15/arm). Decisive: schema-checked ≥70% AND bare <30% → P(H) → 0.85. |
| H-041 | R predicts workflow effectiveness | **0.72** | ±0.00 | — | — |
| H-059 | Cadence skills beat judgment skills for text interventions | **0.72** | ±0.00 | — | — |
| H-093 | Complexity-Induced Verification Collapse | **0.72** | ±0.00 | — | — |
| H-092 | Agent reasoning failures follow predictable IT patterns | **0.72** | ±0.00 | — | — |
| H-087 | Constitutional externalization — three recursive levels | **0.72** | ±0.00 | — | — |
| H-131 | Gate-task synergy — conceptual match gates effectiveness | **0.70** | ±0.00 | — | — |
| H-166-revised | **Low-threshold causal-pointer model** (any causal pointer bridges recognition→execution on cascading bugs) | **0.75** | **± NEW FRAME** (replaces original) | EXP-173 (N=84, clean env) + post-contamination controls inverted arm F (moderate hint) from 0% to 10/10. Original *high-threshold* H-166 effectively **refuted** (P(H-166-original) = 0.10). Revised low-threshold model carried at 0.75 pending EXP-177. KE-199 **deprecated**, replaced by **KE-199b** (low-threshold causal-pointer sufficient). | **EXP-177**: MOD-PARAPHRASE arm ≥80% (rules out A-LEXICAL); BASE N=20 ≤15% (rules out A-ENVCLEAN); PLACEBO null. If all three pass → P(H) → 0.88. If MOD-PARAPHRASE < 60% → revert toward 0.45 (lexical confound dominant). |

### Tier 1 movement since Apr-16

- **H-166 split**: original high-threshold claim collapses (0.82 → 0.10, effectively falsified); revised low-threshold claim enters at **0.75** (net: one hypothesis, mechanism changed).
- **H-165 up**: 0.78 → **0.80** (EXP-166 clean-env confirmation + EXP-179 design lock-in).
- **H-167 carried into scorecard**: **0.73** (was tracker-only at Apr-16). DD-767 / KE-211 added +0.03 on 2026-04-18.
- Net Tier 1 count: **26** (25 from Apr-16 + H-167 explicitly scored; H-166 counted once under revised frame).

---

## Tier 2: Moderate Confidence (P(H) 0.50–0.69)

| # | Hypothesis | P(H) | Δ | Status | Next decisive evidence |
|---|-----------|:----:|:---:|---|---|
| H-107 | Difficulty threshold moderates overhead harm | **0.68** | ±0.00 | KE-196 still the cleanest support. | Medium-difficulty scenarios built. |
| H-096 | Evaluation architecture determines quality ceiling | **0.65** | ±0.00 | Stale. | DAF retrofit. |
| H-164 | Harness-parameter trade-off | **0.65** | ±0.00 | Theory-bound; not directly testable without training access. | Cross-model P-164b comparison. |
| H-163 | Task-type topology sensitivity | **0.60** | ±0.00 | Only 2 task types tested. | 3rd task type + topology mismatch arm. |
| H-014 | Delegation quality binding constraint | **0.63** | ±0.00 | Stale. | EXP-007 Phase 2. |
| H-047 | No forgetting → inverted-U utilization | **0.62** | ±0.00 | Stale. | EXP-053 Phase 3. |
| H-056 | Cooperative convergence | **0.61** | ±0.00 | Stale. | Adversarial review. |
| H-102 | Workflow adoption = internalization | **0.55** | ±0.00 | EXP-148 demoted it; EXP-139 pending. | EXP-139. |
| H-097 | CCC Triad | **0.55** | ±0.00 | Possibly moot. | — |
| H-108 | Guard artifacts as environmental memory | **0.55** | ±0.00 | Blocked by ceiling/floor. | Medium-difficulty gym scenarios. |
| H-166-original | High-threshold (complete-analysis-required) recognition | **0.10** | −0.72 | **EFFECTIVELY REFUTED** — arm F clean-env 10/10 inverts EXP-168's 0/10. Retained in table as a historical marker, not as an active hypothesis. | None planned. Archive candidate once EXP-177 confirms revised frame. |

---

## Tier 3: Weak Signal / Deprioritize (P(H) < 0.50)

| # | Hypothesis | P(H) | Δ | Status |
|---|-----------|:----:|:---:|---|
| H-103 | Format-decoupled gates shift the hump curve | **0.45** | ±0.00 | Archive candidate. |
| H-106 | Observability tax harms ready agents | **0.40** | ±0.00 | Archive candidate. |

---

## The H-165 / H-166 / H-167 Triad

The three hypotheses form a **complementary mechanism stack** on the same failure class (recognition-bottleneck / cascading-bug tasks), not a set of competitors. Each answers a different question about why F1-style expert injection succeeds and self-production fails:

| Hypothesis | Question answered | Mechanism | Scope |
|---|---|---|---|
| **H-165** (displacement) | *Why does combining F1 + F2 collapse to 0% on hard tasks?* | Self-produced analysis **displaces** expert information via capacity consumption; effect is difficulty-moderated (0pp easy / 93pp hard). | Explains the *cost* of forcing self-production when F1 is available. |
| **H-166-revised** (low-threshold pointer) | *What minimum content crosses the recognition threshold?* | **Any** causal pointer to the bug area is sufficient (0% → ~100% jump); symptom-only descriptions degrade to ~75%; pure noise stays at 0%. | Explains the *floor* of useful F1 content on cascading bugs. |
| **H-167** (typed-contract discriminability) | *Within Ch2, why do some structural gates achieve 100% and others ~0%?* | The **shape** of the pointer matters: a schema-checked / discriminably-labeled gate sustains the effect; an ambiguous-handle gate collapses toward Ch1 even though structurally present. | Explains the *form* that makes a gate / hint actually work. |

### Relationship diagram (conceptual)

```
                      H-166-revised
                  "any causal pointer works"
                       (content floor)
                             │
                             ▼
   H-165 ─────────► F1 injection succeeds ◄───────── H-167
   "self-produce                                     "typed contract
    displaces F1"                                     discriminates"
   (capacity cost)                                   (form predicts ceiling)
```

- **H-165 ↔ H-166**: H-166 says the *content* threshold is low; H-165 says the *process* cost of forcing self-production is high on hard tasks. Both point at the same design conclusion: passive-injection beats gated self-production.
- **H-166 ↔ H-167**: H-166's revised claim ("any causal pointer suffices") is silent on *what kind* of pointer. H-167 predicts the pointer's typed-contract shape modulates durability — a lexical-only pointer may succeed via surface token overlap (the A-LEXICAL confound EXP-177 targets), while a typed / schema-anchored pointer succeeds via genuine recognition.
- **H-165 ↔ H-167**: H-165 predicts *capacity* collapse of F2. H-167 predicts *structural-incompleteness* patterns in the artifact chain (P-167e). The two predict **different residual failure distributions** in EXP-179 — an explicit discriminator.

### Discriminating experiments

| Experiment | What it discriminates | Outcome → which hypothesis wins |
|---|---|---|
| **EXP-177** (MOD-PARAPHRASE + BASE N=20 + PLACEBO) | H-166-revised vs A-LEXICAL confound vs A-ENVCLEAN confound | Paraphrase ≥80% → H-166-revised confirmed; < 60% → lexical confound (degrades H-166); BASE ≥40% → env-clean alone sufficient (degrades both). |
| **EXP-179** (difficulty-adaptive content-first guard) | H-165 (capacity) vs H-167 (structural) failure distribution | If EXP-179 content-first-guard failures cluster on **turn-level capacity saturation** → H-165. If they cluster on **schema/oracle-binding mismatches** → H-167 (P-167e). |
| **P-167a** (schema-checked vs bare-existence Ch2 gate) | H-167 vs H-098-only (channel separation sufficient) | Schema-checked ≥70% AND bare <30% → H-167 confirmed. Both ≥70% → H-098 sufficient; H-167 demoted. |
| **P-167d** (typed verification_evidence contract consumed by finish()) | H-167 (contract gap) vs pure verification-discipline failure | >50% drop in FM-3.3 rate without skill change → H-167. Null → discipline-side intervention needed. |

### Decision rule (portfolio)

1. If **EXP-177 + EXP-179** both confirm (H-166-revised passes, H-165 capacity pattern dominates) → passive-injection guards become the default on hard tasks; H-165 → 0.88, H-166-revised → 0.88.
2. If **EXP-179 residuals cluster on schema mismatches** (H-167 pattern) → invest in typed-contract guard infrastructure (Parallax-analog validators); H-167 → 0.85.
3. If **EXP-177 MOD-PARAPHRASE fails** (A-LEXICAL dominant) → H-166-revised demoted to 0.45; re-open whether *any* passive pointer works or whether specific lexical anchors are needed.

---

## Portfolio Summary

| Tier | Count | Notes |
|------|:----:|-------|
| Tier 1 (≥0.70) | 26 | +1 vs Apr-16 (H-167 now explicitly scored). H-166 retained in count under revised frame. |
| Tier 2 (0.50–0.69) | 10 | +1 (H-166-original carried as historical 0.10 marker; also H-164 promoted onto the active table from tracker). |
| Tier 3 (<0.50) | 2 | Unchanged. |
| Archived | 17 | Unchanged. |
| **Total scored** | **55** | +2 vs Apr-16 (53). |

Mean P(H) of active portfolio: ~0.72 (stable — H-167 and H-165 ↑ offset H-166-original ↓).

---

## Narrative: What Changed Since Apr-16

### 1. H-166's mechanism flipped — and that's actually clarifying

The 2026-04-16 scorecard put H-166 (Recognition Threshold) at 0.82 based on EXP-168's step function (0 → 0 → 0 → 100%). The coder-contamination discovery (checkpoint `s_1776358364254_320`) + EXP-173 clean-env re-run showed that the middle zeros were an *environment* artifact, not a cognitive cliff. Arm F (moderate hint) went from 0/10 → 10/10. This does not refute the *binary* character of the recognition jump — it relocates the threshold dramatically lower. The revised model (KE-199b) is: **any causal pointer at the bug area is enough**.

Practically: this *weakens* the case for expensive expert analysis pipelines and *strengthens* the case for cheap, lightweight pointers. It is also the reason EXP-177 is essential — we need to rule out the A-LEXICAL confound before banking the finding.

### 2. H-167 (typed-contract) gained its fourth independent pillar

DD-767 / KE-211 adds a **Coq-mechanized** (42 theorems, 0 Admitted) typed-lambda-calculus study of 835 real agent configs. The YAML-only 54% → YAML+AST 96–100% lint-precision delta mirrors the content-first > process-first pattern of EXP-166. What makes this meaningful is that the mechanism — **compile-time structural completeness** — is disjoint from the three prior pillars (validator typing, retrieval bookmarks, encoding-time discriminators). Four disjoint mechanisms, one invariant (typed-contract discriminability is rate-limiting). Holds at **0.73** because the evidence remains external/convergent, not yet in our gym.

### 3. H-165 is the current best-posed design hypothesis

With EXP-179 designed (difficulty-adaptive content-first guard validation), H-165 is the first hypothesis in this cluster with a *deployment-ready* test. The design explicitly probes the difficulty-moderation prediction (0pp cost on easy, ~93pp on hard). If EXP-179 confirms, the production implication is concrete: deploy content-first guards gated on difficulty estimation.

### 4. KE-199b is the mechanism-update KE of record

The file lives at `agents/shared/knowledge/entries/KE-199b-low-threshold-causal-pointer-sufficient.md` and supersedes KE-199. Every downstream reference to "all-or-nothing step function" or "high completeness threshold" should route to KE-199b instead.

---

## Recommended Actions

1. **Execute EXP-177** — the single most decisive experiment. Resolves H-166-revised vs A-LEXICAL confound. Blocks further investment in passive-injection design if it fails.
2. **Execute EXP-179** — discriminates H-165 (capacity) from H-167 (structural). Also produces deployment-ready data on difficulty-adaptive guard.
3. **Design P-167a gym test** (schema-checked vs bare Ch2 gate on cascading-fix-trap). Direct H-167 confirmation; small N=15/arm.
4. **Archive H-103 and H-106** — third scorecard in a row below threshold with refuted core predictions.
5. **Retire H-166-original** — carry as historical marker; do not score in Apr-20 scorecard.

---

## Cross-Reference: H-066 (Bayesian Belief Management) Update

- 26 high confidence (≥0.70) — +1 vs Apr-16
- 10 moderate (0.50–0.69) — +1 (H-166-original carried, H-164 moved onto table)
- 2 weak — unchanged
- 17 archived — unchanged
- **Falsification event this period**: H-166-original effectively refuted by contamination-fix controls — first hypothesis in this cluster to be mechanistically falsified (not just demoted). Replaced by H-166-revised on the same phenomenon.
- **Triad maturation**: H-165 / H-166-revised / H-167 now form a self-consistent three-mechanism model of F1-style injection, with EXP-177 + EXP-179 + P-167a as the discriminating battery.

---

*Scorecard: 38 active hypotheses scored. 26 high, 10 moderate, 2 weak, 17 archived. Bob (Architect) | 2026-04-18*
*Reconciliation audit: 0 discrepancies vs PRIORITY-TRACKER (H-167 carried at 0.73; H-166 split into -original/-revised consistent with H-166 file).*
*Next update: after EXP-177 result OR EXP-179 result, whichever first.*
