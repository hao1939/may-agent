# Bayesian Hypothesis Scorecard — Fourth Pass

**Date**: 2026-04-13  
**Author**: Bob (Architect)  
**Supersedes**: SCORECARD-bayesian-2026-04-11.md  
**Method**: Manual Bayesian scoring using evidence quality weighting + full reconciliation audit  
**Anchor calibration**: Ground-truth experiments get 0.8 reliability; literature citations get 0.4; internal cross-refs get 0.15; pure theory gets 0.05

## Purpose

Two days of intensive experimentation (EXP-139 through EXP-153) and deep-dive literature synthesis (DD-750 through DD-756, KE-162 through KE-175) have produced:
1. **1 FALSIFIED** hypothesis (H-104, guard dependency escalation — fleet rates declining, not escalating)
2. **1 NEW** hypothesis (H-108, guard artifacts as environmental memory)
3. **5 significant downgrades** — H-102 (0.75→0.55), H-103 (0.72→0.45), H-106 (0.65→0.40), H-107 (0.80→0.65), H-096 (0.68→0.65)
4. **2 upgrades** — H-101 (0.72→0.78), H-105 (0.72→0.75)
5. **New Tier 3** created — H-103 and H-106 fall below 0.50 with limited prospects
6. **Blocked infrastructure**: EXP-146 (Thinking Trace Analysis for H-105) blocked — extended thinking disabled for all agents

## Decision Thresholds (unchanged)

- **≥0.70** → Rely on it (deploy in production, reference as established finding)
- **0.50–0.69** → Active research (worth testing further)
- **0.30–0.49** → Deprioritize (monitor but don't invest)
- **<0.30** → Archive (move to resolved section)

---

## Tier 1: High Confidence (P(H) ≥ 0.70) — 21 hypotheses

| # | Hypothesis | P(H) | Δ from Apr-11 | Key Evidence Since Apr-11 | Reconciliation |
|---|-----------|------|:------------:|--------------------------|:---------------:|
| H-089 | Environmental evidence discovery (cross-reference) closes absent-information gaps | **0.94** | ±0.00 | No new experiments. 37/39 (95%) treatment pass across 4 domains + 2 agents. | File & Tracker agree: **0.94** |
| H-091 | Skill delivery methods between text rules and workflows — few-shot, checklists produce measurable change | **0.93** | ±0.00 | No new experiments. 18/18 domain-matched. Three boundaries confirmed. | File & Tracker agree: **0.93** |
| H-099 | **Discovery Task Boundary** — discovery tasks resist ALL external interventions; creative inference is irreducible to scaffolding | **0.90** | ±0.00 | No new experiments. All 3 channels exhausted. | File & Tracker agree: **0.90** |
| H-095 | Agent-specific failure interventions outperform universal approaches | **0.88** | ±0.00 | EXP-142 (agent-specific guard calibration) in progress — data collection active. EXP-153 adds negative evidence: escalation skill 0pp on impossible tasks, +13pp NS on contradictory tasks. Agent-specific remains correct framing. | File & Tracker agree: **0.88** |
| H-053 | Workflow adoption decays without structural reinforcement | **0.88** | ±0.00 | No new experiments. | File & Tracker agree: **0.88** |
| H-058 | Frustration triggers topology rewrite; forced assessment prevents it | **0.87** | ±0.00 | No new experiments. | File & Tracker agree: **0.87** |
| H-085 | Forced externalization is the general mechanism behind judgment interventions | **0.85** | ±0.00 | DD-755 (artifacts as memory) and KE-164/KE-166 provide theoretical deepening via environmental externalization formalism. No direct P(H) change (theory, not experiment). | File & Tracker agree: **0.85** |
| H-043 | Knowledge utilization bottleneck: U = P(access) × P(applies) × P(helps) | **0.85** | ±0.00 | EXP-140 (read patterns study, N=353 sessions): 37.8% duplicate reads, 73% reads are workspace+KB files. Supports utilization bottleneck model but no direct P(H) change. | File & Tracker agree: **0.85** |
| H-009 | Evaluator heuristic was a rubber stamp (now mitigated) | **0.85** | ±0.00 | EXP-147 Track A: wrong-consensus rate is 0.92% (95% CI: 0.73–1.11%) — well below 5% threshold. Validates mitigation but doesn't change P(H). | File & Tracker agree: **0.85** |
| H-055 | Self-improvement bias: agents modify cosmetically, not substantively | **0.82** | ±0.00 | No new experiments. | File & Tracker agree: **0.82** |
| H-098 | **Attention Channel Theory** — intervention effectiveness determined by channel separation, not content quality | **0.80** | ±0.00 | DD-754 (bias amplification) and KE-162/KE-173 add mechanistic theory but no direct test. EXP-152 ceiling effects consistent with channel theory (Ch2 can't discriminate at ceiling). | File & Tracker agree: **0.80** |
| H-088 | Implementation commitment closes analysis-action gap | **0.80** | ±0.00 | No new experiments. | File & Tracker agree: **0.80** |
| H-101 | **Architectural Readiness Determines Guard Internalization** — agents with workflow-level verification phases show declining guard rates | **0.78** | +0.06 | EXP-145 FALSIFIED H-104 (no escalation spiral), which removes the competing explanation. EXP-149 P-106a: ready agents have LOWER block rate on correct work (34.3% vs 53.5%), confirming internalization is real. DD-750 externalization harm literature provides theoretical grounding. DD-755/KE-164 environmental memory formalism connects to H-108. | File: **0.78**, Tracker: **0.78** ✓ |
| H-054 | LLM judges have fundamental accuracy limits by task type | **0.75** | ±0.00 | EXP-147 Track B (180 observations, 8 scenarios) relevant but no direct test of task-type limits. | File & Tracker agree: **0.75** |
| H-105 | **Three-Layer Reasoning** — agent reasoning operates in three distinct layers: execution, recognition, and discovery | **0.75** | +0.03 | DD-750 literature validates 3× fidelity gap between layers (Young's study: 87.5% vs 28.6%). KE-157 synthesis. **BUT** EXP-146 BLOCKED — extended thinking disabled for all agents, cannot test. Infrastructure prerequisite unmet. | File: **0.75**, Tracker: **0.75** ✓ |
| H-041 | R (eliminable ratio) predicts workflow effectiveness — asymmetric veto model | **0.72** | ±0.00 | No new experiments. | File & Tracker agree: **0.72** |
| H-059 | Cadence skills beat judgment skills for text interventions | **0.72** | ±0.00 | No new experiments. | File & Tracker agree: **0.72** |
| H-093 | Complexity-Induced Verification Collapse (CIVC) | **0.72** | ±0.00 | No new experiments since Apr-11. | File & Tracker agree: **0.72** |
| H-092 | Agent reasoning failures follow predictable information-flow patterns | **0.72** | ±0.00 | No new experiments. | File & Tracker agree: **0.72** |
| H-087 | Constitutional externalization — forced ext at three recursive levels | **0.72** | ±0.00 | No new experiments. | File & Tracker agree: **0.72** |
| H-131 | **Gate-Task Synergy** — gate effectiveness depends on gate-task conceptual match, not gate quantity | **0.70** | ±0.00 | No new experiments. EXP-131 original finding (36pp, h=0.80 large) remains primary evidence. N≈8/arm power limitation is known concern but direction is clear. | File & Tracker agree: **0.70** |

### Tier 1 Movement Since Apr-11
- **2 UPGRADED**: H-101 (0.72→0.78 — H-104 falsification removes competing explanation, EXP-149 confirms), H-105 (0.72→0.75 — DD-750 literature validation, but EXP-146 blocked)
- **1 DEMOTED TO Tier 2**: H-102 (0.75→0.55 — EXP-148)
- **0 NEW**
- Net: 20 → 21 Tier 1 hypotheses (H-131 now explicitly listed at 0.70; was implicit in Apr-11)

**H-131 boundary note**: H-131 (Gate-Task Synergy, P(H) 0.70) remains in Tier 1 despite no new experiments since EXP-131. The original finding (36pp, h=0.80 large) is strong. The N≈8/arm power limitation is a known concern but direction is clear.

---

## Tier 2: Moderate Confidence (P(H) 0.50–0.69) — 8 hypotheses

| # | Hypothesis | P(H) | Δ from Apr-11 | Status | Notes |
|---|-----------|------|:------------:|--------|-------|
| H-096 | Evaluation architecture determines quality ceiling — checkpoint decomposition + state-diff + adaptive rubrics | **0.65** | −0.03 | EXP-143 MIXED (N=100): FM-3.3 sensitivity +32pp (p<0.05), FM-3.1 +35pp (p<0.05), but 85/100 flagged (100% FP rate on clean sessions). Methodology too aggressive. Sequential pattern detection advantage confirmed; overall accuracy improvement unproven. |
| H-107 | **Difficulty Threshold Moderates Overhead Harm** — overhead only harms when task difficulty exceeds ~50% baseline | **0.65** | −0.15 | **EXP-151 INCONCLUSIVE** (159 trials, all 3 buckets): No significant overhead effect at any difficulty level (all p>0.70). Medium bucket +6pp (NS), per-scenario direction inconsistent (M2 reversed). Study severely underpowered for Medium. DD-753 external validation maintains floor. DD-754/KE-162/KE-163 (bias amplification) provides mechanistic complement. KE-167: gym scenarios cluster at ceiling and floor — few usable for moderation testing. Demoted from Tier 1. |
| H-014 | Performance gap is delegation quality, not information regime | **0.63** | ±0.00 | Stale — no new evidence since EXP-007 Phase 1. |
| H-047 | No forgetting → inverted-U knowledge utilization | **0.62** | ±0.00 | Stale — EXP-053 Phase 2 remains latest. |
| H-056 | Cooperative convergence — system-level resistance to change | **0.61** | ±0.00 | Stale — P4 confirmed (17:1 ratio); mechanism unresolved. |
| H-102 | **Workflow Adoption Determines Behavioral Internalization** — "internalization" is architectural substitution | **0.55** | −0.20 | **EXP-148** (59,232 checks, 5,068 sessions): WF-gated decline is universal across ALL agent groups (not learner-specific). Structural break Mar 30–31 points to infrastructure changes as primary driver. P1/P2/P4 failed, only P3 (interaction significance) confirmed. Core thesis weakened but not refuted. EXP-139 production pilot (verify-wrap on optimizer) in progress. |
| H-097 | CCC Triad — multi-agent coordination requires structural cooperation + calibrated agreement + context isolation | **0.55** | −0.10 | EXP-147 Track A: wrong-consensus rate 0.92% — far below 5% threshold. Calibration leg rendered moot (the system doesn't have the calibration problem). Track B complete (180 observations) but does not strengthen the hypothesis since the central problem doesn't exist. |
| H-108 | **Guard Artifacts as Environmental Memory** — guard artifacts function as environmental memory (DD-755 formalism); their persistence reduces downstream capacity requirements | **0.55** | NEW | **EXP-152 Phase 1+2 CEILING EFFECTS** (88+ trials): Phase 1 (kb-discovery-baseline-126, 45 trials) — no effect of targeted guard removal on general tasks. Phase 2 (convention-verify-edit) — ceiling effect, no discriminating signal. KE-169 (null result on general tasks), KE-170 (skills redundant at ceiling). DD-755/KE-164/KE-172 provide theoretical framework. Phase 3 (harder scenarios) needed but gym scenarios cluster at ceiling/floor (KE-167). |

### Tier 2 Movement Since Apr-11
- **3 NEW**: H-107 (demoted from Tier 1, 0.80→0.65), H-102 (demoted from Tier 1, 0.75→0.55), H-108 (new hypothesis, 0.55)
- **2 ADJUSTED DOWN**: H-096 (0.68→0.65), H-097 (0.65→0.55)
- **3 UNCHANGED**: H-014, H-047, H-056
- Net: 5 → 8 Tier 2 hypotheses

---

## Tier 3: Weak Signal / Deprioritize (P(H) < 0.50) — 2 hypotheses

| # | Hypothesis | P(H) | Δ from Apr-11 | Status | Notes |
|---|-----------|------|:------------:|--------|-------|
| H-103 | Format-decoupled gates shift the hump curve rightward | **0.45** | −0.27 | **EXP-144** (N=50): P-144a confirmed (accuracy preserved, ceiling effect — 100% both arms). P-144d REFUTED (decoupled gates 16% SLOWER, d=−1.56). Format overhead provides task decomposition benefits (KE-159). Decoupled gates don't save time and don't reduce FMs. Phase 2 not recommended until harder scenarios available. |
| H-106 | **Observability Tax Harms Architecturally Ready Agents** — forced externalization degrades performance for agents with internalized verification | **0.40** | −0.25 | **EXP-149**: P-106a STRONGLY FALSIFIED (ready agents have 34.3% block rate vs reliant 53.5% — opposite of predicted; z=−7.53, p<0.0001, Cohen's h=−0.389). P-106d FALSIFIED (correction flattened curve). Ready agents internalize BOTH skill AND format. Subsumed by H-107 (difficulty threshold model). |

### Tier 3 Movement Since Apr-11
- **2 NEW**: H-103 (demoted from Tier 1, 0.72→0.45), H-106 (new in Apr-11 PRIORITY-TRACKER at 0.40, never appeared in scorecard Tier 1)
- *Consider archiving both if no experiment planned within 2 weeks*

---

## Archived / Resolved / Disconfirmed — 17 hypotheses

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
| H-104 | **Guard Dependency Escalation — Ch2 forces compliance without transfer** | **0.10** | ❌ **FALSIFIED** — EXP-145: fleet fire rate declining 25.1%→2.6% over 19 days. All 12 conventions show declining trends. No escalation spiral. Transient FM-3.3 dependency self-corrected within days. | **2026-04-12** |

### Archive Movement Since Apr-11
- **1 NEW**: H-104 (FALSIFIED by EXP-145 — was 0.78, core prediction inverted)

---

## Portfolio Summary

| Tier | Count | Hypotheses |
|------|-------|-----------|
| Tier 1 (≥0.70) | 21 | H-089, H-091, H-099, H-095, H-053, H-058, H-085, H-043, H-009, H-055, H-098, H-088, H-101, H-054, H-105, H-041, H-059, H-093, H-092, H-087, H-131 |
| Tier 2 (0.50–0.69) | 8 | H-096, H-107, H-014, H-047, H-056, H-102, H-097, H-108 |
| Tier 3 (<0.50) | 2 | H-103, H-106 |
| Archived | 17 | H-001, H-002, H-034, H-038, H-039, H-046, H-048, H-051, H-052, H-064, H-065, H-070, H-068, H-094, H-100, H-128, H-104 |
| **Total** | **48** | 31 active + 17 archived |

---

## Narrative: What Changed Since Apr-11

### The Ceiling/Floor Problem (Central Theme)

The biggest story of the last two days is the **ceiling/floor measurement crisis**. Three consecutive experiments (EXP-144, EXP-151, EXP-152) hit the same wall: gym scenarios cluster at extreme pass rates (≥90% or ≤10%), leaving no variance for overhead or intervention effects to modulate.

- **EXP-144** (H-103): 100% pass rate both arms. Format-decoupled gates can't show accuracy improvements when accuracy is already perfect.
- **EXP-151** (H-107): Easy bucket at ceiling, Hard bucket at floor. Medium bucket showed +6pp but NS, direction inconsistent across scenarios. 159 trials, no signal.
- **EXP-152** (H-108): Phase 1 null on general tasks. Phase 2 ceiling effect. Guard removal can't show degradation when tasks are trivially solvable.
- **EXP-153** (skill effectiveness): 0% pass both arms on impossible tasks (floor), +13pp NS on contradictory tasks.
- **KE-167**: Systematic analysis confirms gym scenarios cluster at ceiling and floor — "few usable for overhead moderation."

**Implication**: H-107 (difficulty threshold) and H-108 (guard artifacts) cannot be properly tested without medium-difficulty scenarios. This is an infrastructure limitation, not a theoretical one. The hypotheses remain plausible but empirically stuck.

### The Falsification Harvest

Conversely, experiments that DID have discriminating power produced clear falsifications:
- **H-104 FALSIFIED** (EXP-145): Fleet fire rates declining 25.1%→2.6% — the exact opposite of the escalation prediction. The guard dependency spiral doesn't exist.
- **H-106 P-106a FALSIFIED** (EXP-149): Ready agents have LOWER block rates on correct work (34.3% vs 53.5%, z=−7.53). They internalize both skill and format. The "observability tax" story was backwards.
- **H-103 P-144d REFUTED** (EXP-144): Decoupled gates are 16% SLOWER (d=−1.56). Format provides task decomposition benefits, not overhead.

### Theoretical Deepening (DD-750 through DD-756)

Six deep-dives produced substantial theoretical frameworks that don't yet change P(H) values (theory alone gets 0.05 reliability weight) but create testable predictions:

| Deep Dive | Core Insight | Connects To |
|-----------|-------------|-------------|
| DD-750 | Externalization harm is predictable from information regime | H-085, H-099, H-101 |
| DD-753 | ZPD convergence — 5 independent groups validate difficulty threshold mechanism | H-107 |
| DD-754 | Bias amplification in guard chains creates echo chambers | H-107, H-098, KE-162/KE-163 |
| DD-755 | Artifacts-as-memory formalism — persistence reduces capacity requirements | H-108, H-085, KE-164/KE-172 |
| DD-756 | Governed mutation protocols map to guard architecture | H-108, KE-165/KE-174 |

The externalization research program (DD-750/755) and bias amplification work (DD-754) represent the strongest theoretical contributions, predicting that:
1. **When** externalization helps vs. harms depends on information regime (production-fact tasks benefit; discovery tasks are harmed)
2. **Why** guard artifacts persist is because they serve as environmental memory, reducing downstream capacity requirements
3. **How** multi-agent guard chains can amplify biases through echo chamber dynamics

These predictions are testable but require medium-difficulty scenarios that don't yet exist in the gym.

---

## What We Know (High Confidence — 21 hypotheses at ≥0.70)

The system's core dynamics are characterized along **seven** axes (unchanged from Apr-11 in structure, deepened in evidence):

1. **Intervention Tier Hierarchy** (H-098, strongest):
   - Ch1 (Text rules) = 0% on judgment tasks
   - Ch2 (Environmental state — forced ext, cross-ref, structural guards) = 87-100%
   - Ch3 (Positional privilege — task-message few-shot) = 100% behavioral, 0% analytical under coding momentum
   - DD-754/KE-162: Guard chains can amplify biases through echo chamber dynamics (theoretical)

2. **Verification Architecture** (H-101 strengthened):
   - Agents confabulate verification (H-093, 100% rate)
   - "Internalization" is architectural substitution — confirmed by EXP-145 falsification of H-104 and EXP-149 showing ready agents have lower block rates
   - **UPDATE**: H-102 weakened (0.55) — workflow adoption may not be the sole mechanism. Infrastructure changes may be primary driver.

3. **Discovery Task Boundary** (H-099, strongest negative):
   - All intervention channels exhausted. Creative inference irreducible to scaffolding.
   - DD-750: Externalization harm is predictable from information regime

4. **Agent-Specific Interventions** (H-095):
   - Same intervention helps one agent +100pp and harms another −67pp
   - EXP-153: Skills are ineffective at universal floors (0pp on impossible tasks)
   - KE-175: Skill effectiveness requires baseline variance

5. **Failure Mode Taxonomy** (H-092):
   - Three cascade archetypes. FM-3.3 terminal attractor. Agent-specific gradient.

6. **Self-Modification Limits** (H-055, H-053):
   - Cosmetic modification bias. Workflow decay without reinforcement.

7. **Evaluation System** (H-009, H-054):
   - EXP-147: Wrong-consensus rate 0.92% — system is well-calibrated
   - Rubber-stamp bias successfully mitigated

### NEW: What We Learned Doesn't Work

| Hypothesis | What We Tested | Result | Lesson |
|-----------|---------------|--------|--------|
| H-104 (FALSIFIED) | Guard dependency escalation | Fleet rates declining 25→2.6% | Guards DON'T create dependency spirals |
| H-106 (P=0.40) | Observability tax on ready agents | Ready agents have LOWER block rates | The "tax" story was backwards — ready agents internalize format too |
| H-103 (P=0.45) | Format-decoupled gates save time | Decoupled gates 16% SLOWER | Format provides task decomposition benefits |

---

## What We Don't Know (Active Research — 8 hypotheses at 0.50–0.69)

| Hypothesis | Why It Matters | What Would Resolve It | Blocker |
|-----------|---------------|----------------------|---------|
| H-096 (0.65) | 35% verification residual is an architectural ceiling | Direct test (DAF retrofit — EXP-115 redesign needed) | Methodology issues (100% FP rate in EXP-143) |
| H-107 (0.65) | Difficulty threshold predicts when overhead helps vs. harms | Medium-difficulty gym scenarios | Ceiling/floor clustering (KE-167) |
| H-014 (0.63) | Delegation quality may be the binding constraint | EXP-007 Phase 2 | Stale — no progress |
| H-047 (0.62) | KB growth may hurt utilization | EXP-053 Phase 3 | Stale — no progress |
| H-056 (0.61) | System-level resistance to change has a ceiling | Adversarial review experiment | Stale — no progress |
| H-102 (0.55) | Architectural substitution theory needs prospective validation | EXP-139 production pilot results (due Apr-14) | In progress |
| H-097 (0.55) | Multi-agent coordination may need structural cooperation | Central problem may not exist (wrong-consensus <1%) | Moot? |
| H-108 (0.55) | Guard artifacts as environmental memory | Harder scenarios in gym | Ceiling/floor clustering |

### What's Probably Wrong (Tier 3 — 2 hypotheses)

| Hypothesis | P(H) | Prognosis |
|-----------|------|-----------|
| H-103 (0.45) | Format-decoupled gates shift hump curve | **Archive candidate** — core prediction refuted (gates slower, not faster). Residual value only if harder scenarios emerge |
| H-106 (0.40) | Observability tax on ready agents | **Archive candidate** — 2 of 4 predictions strongly falsified (opposite direction). Subsumed by H-107. |

---

## Recommended Actions

### 1. Infrastructure Priority: Medium-Difficulty Scenarios
The #1 blocker is the ceiling/floor clustering problem. H-107, H-108, and several Tier 2 hypotheses cannot advance without scenarios that produce 40-60% baseline pass rates. This is a gym design problem, not a theory problem.

### 2. Resolve In-Progress Experiments
- **EXP-139** (verify-wrap production pilot, optimizer): Due Apr-14. Will resolve H-102 prospective validation.
- **EXP-142** (agent-specific guard calibration): Due Apr-14. Will provide data for H-095 refinement.

### 3. Archive Decisions
- [ ] Archive H-103 if no harder scenarios created by Apr-27
- [ ] Archive H-106 — strong falsification, subsumed by H-107
- [ ] Consider archiving H-097 — central problem (wrong-consensus) doesn't exist at meaningful rates

### 4. Stale Hypothesis Resolution
- [ ] H-014, H-047, H-056 have been stale for >1 week with designed-but-unexecuted experiments
- [ ] Either run the experiments or archive these by Apr-20

### 5. Enable H-105 Testing
- [ ] EXP-146 blocked on extended thinking being disabled. If Three-Layer Reasoning (H-105, P=0.75) matters, enable thinking for at least one agent.

---

## Cross-Reference: H-066 (Bayesian Belief Management) Update

The scorecard process validates H-066:
- **21 high-confidence** (≥0.70): H-055 (0.82), H-041 (0.72), H-053 (0.88), H-059 (0.72), H-085 (0.85), H-058 (0.87), H-009 (0.85), H-043 (0.85), H-054 (0.75), H-091 (0.93), H-089 (0.94), H-088 (0.80), H-092 (0.72), H-093 (0.72), H-087 (0.72), H-095 (0.88), H-098 (0.80), H-099 (0.90), H-101 (0.78), H-105 (0.75), H-131 (0.70) → **21 in Tier 1**
- **8 moderate** (0.50–0.69): H-107 (0.65), H-014 (0.63), H-056 (0.61), H-047 (0.62), H-097 (0.55), H-102 (0.55), H-096 (0.65), H-108 (0.55)
- **2 weak signal** (<0.50): H-103 (0.45), H-106 (0.40)
- **1 meta**: H-066 (Bayesian belief management)
- **17 archived/resolved**: +1 from Apr-11 (H-104 FALSIFIED)
- **H-066 P1 confirmed**: 7 hypotheses scored below 0.40 at some point (predicted ≥5) ✓
- **Mean P(H) active portfolio**: 0.72 (down from 0.78 — reflects honest demotion of 5 hypotheses with failed predictions)
- **Falsification rate**: 1 hypothesis falsified in 2 days + 2 predictions strongly falsified within active hypotheses → system is making testable predictions and honestly updating

**The portfolio is becoming more honest.** The drop in mean P(H) from 0.78→0.72 is healthy — it reflects actual failed predictions being downgraded rather than speculation being maintained. The ceiling/floor measurement problem is now the primary constraint on further empirical progress.

---

*Scorecard: 31 active hypotheses scored. 21 high, 8 moderate, 2 weak, 17 archived. Bob (Architect) | 2026-04-13*  
*Reconciliation audit: 0 discrepancies. Authority hierarchy: file > tracker > scorecard.*  
*Next update: After EXP-139/EXP-142 complete (~Apr-14) or after 5+ new experiments.*
