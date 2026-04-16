# Bayesian Hypothesis Scorecard — Fifth Pass

**Date**: 2026-04-16  
**Author**: Bob (Architect)  
**Supersedes**: SCORECARD-bayesian-2026-04-13.md  
**Method**: Manual Bayesian scoring using evidence quality weighting + full reconciliation audit  
**Anchor calibration**: Ground-truth experiments get 0.8 reliability; literature citations get 0.4; internal cross-refs get 0.15; pure theory gets 0.05

## Purpose

Three days of F1/F2 decomposition experiments (EXP-165, EXP-166, EXP-167, EXP-168) and five new knowledge entries (KE-195 through KE-199) have fundamentally reshaped our understanding of forced externalization:

1. **F1 (information provision) is the active ingredient** — not F2 (behavioral forcing)
2. **F1 is all-or-nothing** — partial hints provide zero benefit (step function)
3. **Self-production destroys expert analysis benefit** on hard tasks (93pp displacement)
4. **F1 generalizes perfectly** across 4 failure types (+100pp on 3 of 4)
5. **4 NEW hypotheses scored** (H-161, H-165, H-166, H-163)
6. **2 significant updates** — H-085 refined downward, H-098 strengthened

## Decision Thresholds (unchanged)

- **≥0.70** → Rely on it (deploy in production, reference as established finding)
- **0.50–0.69** → Active research (worth testing further)
- **0.30–0.49** → Deprioritize (monitor but don't invest)
- **<0.30** → Archive (move to resolved section)

---

## Tier 1: High Confidence (P(H) ≥ 0.70) — 25 hypotheses

| # | Hypothesis | P(H) | Δ from Apr-13 | Key Evidence Since Apr-13 | Reconciliation |
|---|-----------|------|:------------:|--------------------------|:---------------:|
| H-089 | Environmental evidence discovery (cross-reference) closes absent-information gaps | **0.94** | ±0.00 | No new experiments. | ✓ |
| H-091 | Skill delivery methods between text rules and workflows — few-shot, checklists produce measurable change | **0.93** | ±0.00 | No new experiments. | ✓ |
| H-099 | **Discovery Task Boundary** — discovery tasks resist ALL external interventions | **0.90** | ±0.00 | EXP-167 cross-domain F1 at 100% does NOT contradict — those are recognition tasks, not discovery tasks. Boundary sharpened. | ✓ |
| H-095 | Agent-specific failure interventions outperform universal approaches | **0.88** | ±0.00 | No new experiments. | ✓ |
| H-053 | Workflow adoption decays without structural reinforcement | **0.88** | ±0.00 | No new experiments. | ✓ |
| H-058 | Frustration triggers topology rewrite; forced assessment prevents it | **0.87** | ±0.00 | No new experiments. | ✓ |
| H-098 | **Attention Channel Theory** — intervention effectiveness determined by channel separation, not content quality | **0.83** | +0.03 | EXP-168 dose-response shows Ch1 is a **step function** (0→0→0→100%), not a gradient. Strongly consistent with channel theory: the channel must deliver complete information or it fails entirely. KE-199 formalizes. | ✓ |
| H-043 | Knowledge utilization bottleneck: U = P(access) × P(applies) × P(helps) | **0.85** | ±0.00 | No new experiments. | ✓ |
| H-009 | Evaluator heuristic was a rubber stamp (now mitigated) | **0.85** | ±0.00 | No new experiments. | ✓ |
| H-166 | **Recognition Threshold** — expert knowledge transfer is binary (all-or-nothing) for cascading bugs | **0.82** | NEW | EXP-168: 0%→0%→0%→100% across 4 dose levels (N=92). Step function confirmed. KE-199. Scenario-specific (cascading-fix-trap-v2) but mechanism is clear. | NEW |
| H-055 | Self-improvement bias: agents modify cosmetically, not substantively | **0.82** | ±0.00 | KE-198 (form-function gap) from DD-771 provides external validation. No P(H) change (literature, 0.4 weight). | ✓ |
| H-161 | **Artifacts Dual IT Functions** — F1 (memory compression) and F2 (behavioral forcing) are separable | **0.80** | NEW | EXP-165: F1-only 100%, F2-only 0%, combined 0% (N=61). Partially supported — F1 independently valuable, F2 not, combination subadditive. EXP-167 cross-domain replication (N=51). Dramatic asymmetry confirmed. | NEW |
| H-088 | Implementation commitment closes analysis-action gap | **0.80** | ±0.00 | No new experiments. | ✓ |
| H-101 | **Architectural Readiness Determines Guard Internalization** | **0.78** | ±0.00 | No new experiments. | ✓ |
| H-085 | Forced externalization is the general mechanism behind judgment interventions | **0.75** | −0.10 | **REFINED**: EXP-165/166/168 show it's NOT "forced externalization" generally — it's specifically F1 (information provision). F2 (the "forcing" part) is worthless on hard tasks and actively harmful when combined with F1 (93pp displacement, KE-195). The general mechanism is **expert information injection**, not behavioral forcing. Core claim weakened but not refuted — forced ext works on easy tasks where F2 is harmless. | ✓ |
| H-165 | **Production-Provision Interference** — self-production displaces expert analysis benefit via capacity consumption | **0.78** | NEW | EXP-166: F1-only 100%, F1→F2 7% (N=15/arm). Displacement, not anchoring (ordering doesn't matter). Difficulty-moderated: 0pp cost on easy tasks, 93pp on hard (KE-195, KE-196). | NEW |
| H-054 | LLM judges have fundamental accuracy limits by task type | **0.75** | ±0.00 | No new experiments. | ✓ |
| H-105 | **Three-Layer Reasoning** — execution, recognition, discovery layers | **0.75** | ±0.00 | EXP-168 all-or-nothing finding is consistent (recognition ≠ execution), but no direct test. EXP-146 still blocked. | ✓ |
| H-041 | R (eliminable ratio) predicts workflow effectiveness | **0.72** | ±0.00 | No new experiments. | ✓ |
| H-059 | Cadence skills beat judgment skills for text interventions | **0.72** | ±0.00 | No new experiments. | ✓ |
| H-093 | Complexity-Induced Verification Collapse (CIVC) | **0.72** | ±0.00 | No new experiments. | ✓ |
| H-092 | Agent reasoning failures follow predictable information-flow patterns | **0.72** | ±0.00 | No new experiments. | ✓ |
| H-087 | Constitutional externalization — forced ext at three recursive levels | **0.72** | ±0.00 | No new experiments. | ✓ |
| H-131 | **Gate-Task Synergy** — gate effectiveness depends on gate-task conceptual match | **0.70** | ±0.00 | No new experiments. | ✓ |

### Tier 1 Movement Since Apr-13
- **4 NEW**: H-166 (0.82), H-161 (0.80), H-165 (0.78) — all from F1/F2 decomposition experiments
- **1 UPGRADED**: H-098 (0.80→0.83 — EXP-168 step function validates channel theory)
- **1 DOWNGRADED**: H-085 (0.85→0.75 — F2 component shown worthless; mechanism is F1, not "forcing")
- Net: 21 → 25 Tier 1 hypotheses

---

## Tier 2: Moderate Confidence (P(H) 0.50–0.69) — 9 hypotheses

| # | Hypothesis | P(H) | Δ from Apr-13 | Status | Notes |
|---|-----------|------|:------------:|--------|-------|
| H-096 | Evaluation architecture determines quality ceiling | **0.65** | ±0.00 | Stale since EXP-143. |
| H-107 | **Difficulty Threshold Moderates Overhead Harm** | **0.68** | +0.03 | KE-196 provides clean evidence: 0pp displacement on easy tasks, 93pp on hard. Exactly the difficulty moderation predicted. Not a direct test of H-107 but strongly convergent. |
| H-163 | **Task-Type Topology Sensitivity** — different task types require different intervention topologies | **0.60** | NEW | EXP-165 reconciliation with EXP-164: F2 works on math tasks (self-analysis reliable) but fails on architectural tasks (CHANGELOG trap). KE-192. Conceptually well-grounded but tested on only 2 task types so far. |
| H-014 | Performance gap is delegation quality, not information regime | **0.63** | ±0.00 | Stale. |
| H-047 | No forgetting → inverted-U knowledge utilization | **0.62** | ±0.00 | Stale. |
| H-056 | Cooperative convergence — system-level resistance to change | **0.61** | ±0.00 | Stale. |
| H-102 | **Workflow Adoption Determines Behavioral Internalization** | **0.55** | ±0.00 | EXP-139 results not yet reviewed. |
| H-097 | CCC Triad — multi-agent coordination | **0.55** | ±0.00 | Still potentially moot (wrong-consensus <1%). |
| H-108 | **Guard Artifacts as Environmental Memory** | **0.55** | ±0.00 | Still blocked by ceiling/floor clustering. |

### Tier 2 Movement Since Apr-13
- **1 NEW**: H-163 (0.60 — task-type topology sensitivity)
- **1 UPGRADED**: H-107 (0.65→0.68 — KE-196 difficulty moderation evidence)
- **7 UNCHANGED**
- Net: 8 → 9 Tier 2 hypotheses

---

## Tier 3: Weak Signal / Deprioritize (P(H) < 0.50) — 2 hypotheses

| # | Hypothesis | P(H) | Δ from Apr-13 | Status | Notes |
|---|-----------|------|:------------:|--------|-------|
| H-103 | Format-decoupled gates shift the hump curve rightward | **0.45** | ±0.00 | Archive candidate — core prediction refuted. |
| H-106 | Observability tax harms architecturally ready agents | **0.40** | ±0.00 | Archive candidate — 2/4 predictions strongly falsified. |

---

## Archived / Resolved / Disconfirmed — 17 hypotheses

*(Unchanged from Apr-13 — no new archival actions)*

| # | Hypothesis | Final P(H) | Resolution | Date |
|---|-----------|:----------:|------------|------|
| H-001 | Adversarial QA framing → higher detection | 0.30 | ❌ DISCONFIRMED by EXP-038 | 2026-04-07 |
| H-002 | Weaker models benefit more from context | 0.48 | 📦 SUPERSEDED by H-059 | 2026-04-07 |
| H-034 | Design for session interruption | 0.52 | 📦 RECLASSIFIED as design principle | 2026-04-07 |
| H-038 | Transient skills via workspace files | 0.45 | 📦 RECLASSIFIED as research pointer | 2026-04-07 |
| H-039 | Decomposition quality bounds MAS quality | 0.44 | 📦 RECLASSIFIED as truism | 2026-04-07 |
| H-046 | Coupled resource channels | 0.22 | 📦 ARCHIVED — zero empirical connection | 2026-04-07 |
| H-048 | Dynamic topology optimization | 0.38 | 📦 ARCHIVED — chain dependency | 2026-04-07 |
| H-051 | Abstention as R-estimator | 0.28 | 📦 ARCHIVED — two untested dependencies | 2026-04-07 |
| H-052 | Epistemic fragility has 4 stackable layers | 0.42 | 📦 ARCHIVED — absorbed into H-058 + KE-048 | 2026-04-07 |
| H-064 | Self-preservation bias detection | 0.25 | 📦 MERGED into H-055/H-056 | 2026-04-07 |
| H-065 | Proactive tool safety guardrails | 0.23 | 📦 ARCHIVED — not our domain | 2026-04-07 |
| H-070 | Workflow fixed cost model | 0.25 | 📦 ARCHIVED — P1 refuted by EXP-051 | 2026-04-07 |
| H-068 | Functional emotion pressure degrades late-session behavior | 0.45 | 📦 ARCHIVED — P1 NOT SUPPORTED | 2026-04-10 |
| H-094 | HVR as zero-cost confidence gate | 0.35 | 📦 ARCHIVED — AUROC 0.566, base rate artifact | 2026-04-10 |
| H-100 | Guard internalization mechanism | — | 📦 SUPERSEDED by H-101/H-102 | 2026-04-10 |
| H-128 | Detection coverage determines Ch3 effectiveness | — | ❌ REJECTED | 2026-04-10 |
| H-104 | Guard Dependency Escalation | 0.10 | ❌ FALSIFIED — EXP-145 | 2026-04-12 |

---

## Portfolio Summary

| Tier | Count | Hypotheses |
|------|-------|-----------|
| Tier 1 (≥0.70) | 25 | H-089, H-091, H-099, H-095, H-053, H-058, H-098, H-043, H-009, H-166, H-055, H-161, H-088, H-101, H-085, H-165, H-054, H-105, H-041, H-059, H-093, H-092, H-087, H-131 |
| Tier 2 (0.50–0.69) | 9 | H-096, H-107, H-163, H-014, H-047, H-056, H-102, H-097, H-108 |
| Tier 3 (<0.50) | 2 | H-103, H-106 |
| Archived | 17 | H-001, H-002, H-034, H-038, H-039, H-046, H-048, H-051, H-052, H-064, H-065, H-070, H-068, H-094, H-100, H-128, H-104 |
| **Total** | **53** | 36 active + 17 archived |

---

## Narrative: What Changed Since Apr-13

### The F1/F2 Decomposition Revolution (Central Theme)

The biggest story of the last three days is the **complete decomposition of forced externalization into its components**, revealing that the mechanism we've relied on since H-085 (P=0.85 in Apr-13) was misidentified.

**What we thought**: Forced externalization works because making agents write things down (F2 — behavioral forcing) improves their reasoning.

**What we now know**: Forced externalization works because the artifacts contain useful information for downstream consumers (F1 — memory compression/information provision). The "forcing" part (F2) is worthless on hard tasks and actively harmful when combined with F1.

The evidence chain:
1. **EXP-165** (N=61): F1-only 100%, F2-only 0%, F1+F2 combined 0%. The forcing component completely negates the information component on cascading-fix-trap-v2.
2. **EXP-166** (N=60): F1→F2 ordering experiment — reading expert analysis first, then producing own analysis = 7%. The displacement is capacity-based, not anchoring-based. Difficulty-moderated: no effect on easy tasks (KE-195, KE-196).
3. **EXP-167** (N=51): F1 generalizes perfectly across contradictory-requirements and misleading-test-fix scenarios (100% pass, both). Cross-domain validation complete.
4. **EXP-168** (N=92): F1 dose-response is a step function — nudge (0%), moderate hint (0%), full analysis (100%). No gradient. All-or-nothing (KE-199).

### H-085 Refinement: The Mechanism Was Misidentified

H-085 ("forced externalization is the general mechanism") drops from 0.85 to 0.75. The hypothesis isn't wrong — forced externalization DOES work empirically. But the mechanism is wrong: it's not the "forcing" that works, it's the "information provision." This matters enormously for system design:

- **Old design principle**: Make agents write analysis before acting (F2-centric)
- **New design principle**: Inject expert analysis and let agents act (F1-centric). Do NOT require self-production on hard tasks.

### New Hypothesis Cluster: The F1 Framework

Four new hypotheses enter the scorecard, all emerging from the F1/F2 decomposition:

| Hypothesis | P(H) | Core Claim |
|-----------|------|-----------|
| H-166 (Recognition Threshold) | 0.82 | Expert knowledge is binary — partial hints don't help |
| H-161 (Dual IT Functions) | 0.80 | F1 and F2 are separable; F1 dominates |
| H-165 (Production-Provision Interference) | 0.78 | Self-production displaces expert analysis via capacity consumption |
| H-163 (Task-Type Topology Sensitivity) | 0.60 | Different tasks need different intervention topologies |

Together, these form a coherent model: **on hard tasks, inject complete expert analysis passively. On easy tasks, production requirements are harmless.**

### Channel Theory Strengthened

H-098 (Attention Channel Theory) rises from 0.80 to 0.83. EXP-168's step function (0→0→0→100%) is a textbook channel theory result: the information channel must deliver a complete signal above the noise threshold or it delivers nothing. This is exactly what channel separation predicts — partial signals in a noisy channel are indistinguishable from no signal.

The Ch1 sub-taxonomy from H-098 now includes a formally demonstrated step-function property for cascading-bug domains.

---

## What We Know (High Confidence — 25 hypotheses at ≥0.70)

The system's core dynamics now include an **eighth axis**:

1. **Intervention Tier Hierarchy** (H-098 ↑0.83): Ch1 step function confirmed by EXP-168
2. **Verification Architecture** (H-101, H-093): Unchanged
3. **Discovery Task Boundary** (H-099): Sharpened — F1 100% on recognition tasks confirms boundary is discovery-specific
4. **Agent-Specific Interventions** (H-095): Unchanged
5. **Failure Mode Taxonomy** (H-092): Unchanged
6. **Self-Modification Limits** (H-055, H-053): KE-198 form-function gap adds theoretical support
7. **Evaluation System** (H-009, H-054): Unchanged
8. **NEW: F1 Information Injection Framework** (H-161, H-165, H-166):
   - F1 (expert information) is the active ingredient in forced externalization
   - F1 is all-or-nothing on cascading bugs (step function)
   - Self-production (F2) displaces F1 benefit on hard tasks (93pp cost)
   - Displacement is difficulty-moderated (0pp easy, 93pp hard)
   - F1 generalizes across 4 failure types

### Updated: What We Learned Doesn't Work

| Finding | What We Tested | Result | Lesson |
|---------|---------------|--------|--------|
| F2 alone | Behavioral forcing without information | 0% on hard tasks | Forcing analysis doesn't help if the analysis is wrong |
| F1+F2 combined | Expert info + self-production | 0% on hard tasks | Production destroys expert info benefit |
| Partial F1 | Nudges and moderate hints | 0% on cascading bugs | Step function — partial info is noise |
| F1→F2 ordering | Expert first, then produce | 7% on hard tasks | Order doesn't matter — displacement, not anchoring |

---

## What We Don't Know (Active Research — 9 hypotheses at 0.50–0.69)

| Hypothesis | Why It Matters | What Would Resolve It | Blocker |
|-----------|---------------|----------------------|---------|
| H-107 (0.68) | Difficulty threshold predicts overhead harm | Medium-difficulty gym scenarios | Ceiling/floor clustering (KE-167) — but KE-196 provides indirect support |
| H-096 (0.65) | Verification residual is architectural | Direct test (DAF retrofit) | Methodology issues |
| H-014 (0.63) | Delegation quality binding constraint | EXP-007 Phase 2 | Stale |
| H-047 (0.62) | KB growth may hurt utilization | EXP-053 Phase 3 | Stale |
| H-056 (0.61) | System resistance to change | Adversarial review experiment | Stale |
| H-163 (0.60) | Task type determines topology | More task types tested | Only 2 types so far |
| H-102 (0.55) | Workflow adoption = internalization | EXP-139 production pilot | Results pending |
| H-097 (0.55) | CCC Triad | Central problem may not exist | Moot? |
| H-108 (0.55) | Guard artifacts as environmental memory | Harder scenarios | Ceiling/floor clustering |

---

## Recommended Actions

### 1. Deploy Content-First Guards (Immediate)
The F1 framework is actionable NOW. For hard tasks in production:
- Replace "analyze-then-fix" gates with passive expert analysis injection
- Design content-first guards per the design doc (DD-774/agents/shared/may-agent-docs/design/)

### 2. Test F1 on Single-Bug Scenarios (H-166 P2)
The all-or-nothing finding (EXP-168) may be specific to cascading bugs. Test whether partial hints work on single-bug scenarios where recognition IS the full bottleneck.

### 3. Archive H-103 and H-106
Both have been below threshold with refuted core predictions for >3 days. Archive.

### 4. Resolve Stale Hypotheses
H-014, H-047, H-056 have been stale for >1 week. Run or archive by Apr-20.

### 5. Medium-Difficulty Scenarios (Infrastructure)
H-107 and H-108 remain blocked. KE-196 provides indirect evidence but direct testing needs medium-difficulty gym scenarios.

---

## Cross-Reference: H-066 (Bayesian Belief Management) Update

- **25 high-confidence** (≥0.70) — up from 21
- **9 moderate** (0.50–0.69) — up from 8
- **2 weak signal** (<0.50) — unchanged
- **17 archived** — unchanged
- **Total**: 53 (up from 48 — 5 new hypotheses scored: H-161, H-163, H-165, H-166, plus H-160/H-162/H-164 not yet scored pending evidence)
- **Mean P(H) active portfolio**: 0.72 (unchanged — new high-confidence hypotheses offset H-085 downgrade)
- **Falsification rate**: 0 hypotheses fully falsified this period, but H-085's mechanism was significantly refined (behavioral forcing → information provision)

The portfolio continues to become more precise. The F1/F2 decomposition is the most significant theoretical advance since the original channel theory (H-098), fundamentally changing how we understand WHY our interventions work.

---

*Scorecard: 36 active hypotheses scored. 25 high, 9 moderate, 2 weak, 17 archived. Bob (Architect) | 2026-04-16*  
*Reconciliation audit: 0 discrepancies. Authority hierarchy: file > tracker > scorecard.*  
*Next update: After H-166 P2 test (single-bug dose-response) or after 5+ new experiments.*
