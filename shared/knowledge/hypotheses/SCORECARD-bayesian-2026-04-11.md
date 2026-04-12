# Bayesian Hypothesis Scorecard — Third Pass

**Date**: 2026-04-11  
**Author**: Bob (Architect)  
**Supersedes**: SCORECARD-bayesian-2026-04-09.md  
**Method**: Manual Bayesian scoring using evidence quality weighting + full reconciliation audit  
**Anchor calibration**: Ground-truth experiments get 0.8 reliability; literature citations get 0.4; internal cross-refs get 0.15; pure theory gets 0.05

## Purpose

Two days of intensive experimentation (EXP-108 through EXP-138, plus production deployments) have expanded the evidence base significantly. This scorecard:
1. **Adds** 5 new hypotheses to Tier 1 (H-095, H-098, H-099, H-101, H-102)
2. **Incorporates** evidence from 30+ experiments completed since Apr-9
3. **Archives** 4 hypotheses (H-068, H-094, H-100, H-128)
4. **Reconciles** file vs. tracker discrepancies — when they disagree, this scorecard is authoritative

## Decision Thresholds (unchanged)

- **≥0.70** → Rely on it (deploy in production, reference as established finding)
- **0.50–0.69** → Active research (worth testing further)
- **0.30–0.49** → Deprioritize (monitor but don't invest)
- **<0.30** → Archive (move to resolved section)

---

## Tier 1: High Confidence (P(H) ≥ 0.70) — 20 hypotheses

| # | Hypothesis | P(H) | Δ from Apr-9 | Key Evidence Since Apr-9 | Reconciliation |
|---|-----------|------|:------------:|--------------------------|:---------------:|
| H-089 | Environmental evidence discovery (cross-reference) closes absent-information gaps | **0.94** | ±0.00 | No new experiments. 37/39 (95%) treatment pass across 4 domains + 2 agents. | File & Tracker agree: **0.94** |
| H-091 | Skill delivery methods between text rules and workflows — few-shot, checklists produce measurable change | **0.93** | ±0.00 | No new experiments. 18/18 domain-matched. Three boundaries confirmed. | File & Tracker agree: **0.93** |
| H-099 | **Discovery Task Boundary** — discovery tasks resist ALL external interventions; creative inference is irreducible to scaffolding | **0.90** | NEW | EXP-117 (−67pp), EXP-120 (−50pp), EXP-121 (+16pp NS), EXP-122 (null), EXP-124 (null), EXP-126 (null), EXP-130 (−67pp). All 3 channels exhausted. Ch1 harmful, Ch2 null, Ch3 harmful. | File & Tracker agree: **0.90** |
| H-053 | Workflow adoption decays without structural reinforcement | **0.88** | ±0.00 | No new experiments. EXP-028 natural experiment (51pp coach degradation) remains strongest evidence. | File & Tracker agree: **0.88** |
| H-085 | Forced externalization is the general mechanism behind judgment interventions | **0.85** | −0.03 | EXP-117 (−67pp, checklist HARMS discovery), EXP-120 (progressive tracking also harms), EXP-122 (env hints null), EXP-126 (env hints replicated null), EXP-124 (structural null), EXP-132 (3rd Ch2 guard deployed). **5 boundaries confirmed, discovery boundary UNRESOLVED.** | File & Tracker agree: **0.85** |
| H-058 | Frustration triggers topology rewrite; forced assessment prevents it | **0.87** | ±0.00 | No new experiments. DD#516 + EXP-048/049 still primary. | File & Tracker agree: **0.87** |
| H-043 | Knowledge utilization bottleneck: U = P(access) × P(applies) × P(helps) | **0.85** | ±0.00 | No new experiments. 11 evidence sources. | File & Tracker agree: **0.85** |
| H-009 | Evaluator heuristic was a rubber stamp (now mitigated) | **0.85** | ±0.00 | No new experiments. 4 mitigation phases deployed. | File & Tracker agree: **0.85** |
| H-095 | Agent-specific failure interventions outperform universal approaches | **0.88** | +0.06 | EXP-113 (FM-Heavy Workers, N=398, all 5 H confirmed), EXP-114 (FM-2.1 guard Phase A), EXP-115 (+100pp optimizer guard), EXP-116 (re-validated), EXP-117 (−67pp same checklist helps optimizer but harms Bob), EXP-120/122/126 (3 more universal failures), EXP-123 (production differential — 5 agents helped, 1 failed, 1 harmed), EXP-124 (null, removes 1 guard but EXP-132 restores), EXP-132 (3rd agent-specific guard). | File & Tracker agree: **0.88** |
| H-055 | Self-improvement bias: agents modify cosmetically, not substantively | **0.82** | ±0.00 | No new experiments. DD-556 organizational-scale validation. | File & Tracker agree: **0.82** |
| H-088 | Implementation commitment closes analysis-action gap | **0.80** | ±0.00 | No new experiments. EXP-073/088 remain primary. | File & Tracker agree: **0.80** |
| H-098 | **Attention Channel Theory** — intervention effectiveness determined by channel separation, not content quality | **0.80** | NEW | EXP-127 (Ch1 0/6, Ch2 6/6, Ch3 0/6; p<0.00001). EXP-128 (Ch3 boundary is task-type, not content quality). EXP-129 (Ch2 budget ≥3 related gates, no cliff). EXP-131 (relevance is key moderator, unrelated gates dilute). 3/4 predictions correct + 1 boundary clarified. | File & Tracker agree: **0.80** |
| H-102 | **Workflow Adoption Determines Behavioral Internalization** — "internalization" is architectural substitution, not behavioral learning | **0.55** ← *was 0.75* | EXP-148 (−0.20) | EXP-137 (r=1.0, 6 agents), May's Paradox. **BUT** EXP-148 found WF-gated decline is universal across ALL agent groups (not learner-specific), structural break on Mar 30–31 points to infrastructure changes as primary driver, P1/P2/P4 failed, only P3 (interaction significance) confirmed. | EXP-148: **0.55** |
| H-054 | LLM judges have fundamental accuracy limits by task type | **0.75** | ±0.00 | No new experiments. EXP-052 Phase 1+2 (r=0.81 RIFT-agreement). | File & Tracker agree: **0.75** |
| H-041 | R (eliminable ratio) predicts workflow effectiveness — asymmetric veto model | **0.72** | ±0.00 | No new experiments. | File & Tracker agree: **0.72** |
| H-059 | Cadence skills beat judgment skills for text interventions | **0.72** | ±0.00 | No new experiments. Partially absorbed into H-091. | File & Tracker agree: **0.72** |
| H-092 | Agent reasoning failures follow predictable information-flow patterns | **0.72** | ±0.00 | No new experiments beyond EXP-099 (999 FM errors, 384 sessions). | File & Tracker agree: **0.72** |
| H-093 | Complexity-Induced Verification Collapse (CIVC) | **0.72** | +0.02 | EXP-116 re-validated (May investigation confirmed `coder` is valid agent). EXP-123 production success (verification-depth guard). EXP-133 (gym null — measurement artifact). EXP-110 (35% residual = CIVC manifestation). | File & Tracker agree: **0.72** |
| H-087 | Constitutional externalization — forced ext at three recursive levels | **0.72** | ±0.00 | EXP-124 v2 null result — L7 evidence removed, P(H) reverted from 0.75→0.72. Net change zero from Apr-9 (which already corrected to 0.72). | File & Tracker agree: **0.72** |
| H-101 | **Architectural Readiness Determines Guard Internalization** — agents with workflow-level verification phases show declining guard rates | **0.72** | NEW | EXP-135 (bifurcated response), EXP-136 (20% inflation, sharpened bifurcation), EXP-137 (perfect correlation 1.0 — workflow verification is sole differentiator), EXP-138 (gym ceiling). May's Paradox central evidence. | File & Tracker agree: **0.72** |

### Tier 1 Movement Since Apr-9
- **5 NEW** entries: H-095 (0.88 — wasn't in Apr-9 scorecard), H-098 (0.80), H-099 (0.90), H-101 (0.72), H-102 (0.75)
- **1 ADJUSTED DOWN**: H-085 (0.88→0.85 — discovery boundary)
- **1 ADJUSTED UP**: H-093 (0.70→0.72 — re-validated)
- **0 DEMOTED**
- Net: 15 → 20 Tier 1 hypotheses

---

## Tier 2: Moderate Confidence (P(H) 0.50–0.69) — 5 hypotheses

| # | Hypothesis | P(H) | Δ from Apr-9 | Status | Notes |
|---|-----------|------|:------------:|--------|-------|
| H-096 | Evaluation architecture determines quality ceiling — checkpoint decomposition + state-diff + adaptive rubrics will break 35% verification residual | **0.68** | NEW | All evidence indirect (KE-116, DD-720/721/722/723). Needs EXP-115 (DAF retrofit) for first direct test. |
| H-097 | CCC Triad — multi-agent coordination requires structural cooperation + calibrated agreement + context isolation | **0.65** | NEW | Strong external evidence (o3 17% vs o3-mini 50%, DACS 90-98.4%). Untested internally. |
| H-014 | Performance gap is delegation quality, not information regime | **0.63** | ±0.00 | Stale — no new evidence since EXP-007 Phase 1. |
| H-047 | No forgetting → inverted-U knowledge utilization | **0.62** | ±0.00 | Stale — EXP-053 Phase 2 remains latest. |
| H-056 | Cooperative convergence — system-level resistance to change | **0.61** | ±0.00 | Stale — P4 confirmed (17:1 ratio); mechanism unresolved. |

### Tier 2 Movement Since Apr-9
- **2 NEW**: H-096 (0.68), H-097 (0.65)
- **3 UNCHANGED**: H-014, H-047, H-056
- Net: 3 → 5 Tier 2 hypotheses

---

## Tier 3: Weak Signal / Deprioritize (P(H) < 0.50) — 0 hypotheses

*No active hypotheses in this tier.* Both former Tier 3 entries (H-068, H-094) have been archived.

---

## Archived / Resolved / Disconfirmed — 16 hypotheses

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
| H-070 | Workflow fixed cost model | 0.25 | 📦 ARCHIVED — P1 refuted by EXP-051. Superseded by KE-052 | 2026-04-07 |
| H-068 | Functional emotion pressure degrades late-session behavior | 0.45 | 📦 ARCHIVED — P1 NOT SUPPORTED (EXP-037). No further experiments planned | 2026-04-10 |
| H-094 | HVR (Hedge-to-Verify Ratio) as zero-cost confidence gate | 0.35 | 📦 ARCHIVED — AUROC 0.566, base rate artifact, survivorship bias fatal | 2026-04-10 |
| H-128 | Detection Coverage Determines Ch3 Few-Shot Effectiveness | 0.05 | ❌ REJECTED by EXP-128 — content quality is NOT the Ch3 moderator | 2026-04-10 |
| H-100 | Skill-Guard Divergence — Internalization vs. Permanent Infrastructure | 0.60 | 📦 SUPERSEDED by H-101/H-102. Original content-vs-process mechanism disproven by EXP-137 | 2026-04-11 |

### Archive Movement Since Apr-9
- **4 NEW**: H-068 (archived 2026-04-10), H-094 (archived 2026-04-10), H-128 (rejected 2026-04-10), H-100 (superseded 2026-04-11)
- Net: 12 → 16 archived

---

## Reconciliation Audit: Discrepancies Found & Resolved

| Hypothesis | PRIORITY-TRACKER | Individual File | **This Scorecard** | Resolution |
|-----------|:----------------:|:--------------:|:------------------:|------------|
| H-095 | 0.88 | 0.88 | **0.88** | Agree. Updated since Apr-9 via EXP-113/115/117/120/122/123/132. |
| H-098 | 0.80 | 0.80 | **0.80** | Agree. New since Apr-9. |
| H-099 | 0.90 | 0.90 | **0.90** | Agree. New since Apr-9 (was "proposed" at 0.78, confirmed to 0.90 by EXP-130). |
| H-085 | 0.85 | 0.85 | **0.85** | Agree. Down from 0.88 (discovery boundary). |
| H-093 | 0.72 | 0.72 | **0.72** | Agree. Up from 0.70 (re-validated after May investigation). |
| H-101 | 0.72 | 0.72 | **0.72** | Agree. New since Apr-9. |
| H-102 | 0.55 | 0.55 | **0.55** | Revised down from 0.75 by EXP-148. |
| H-091 | 0.93 | 0.93 | **0.93** | Agree. No change. |
| H-087 | **0.72** | **0.72** | **0.72** | Agree. Tracker corrected since Apr-9 (was 0.65). |

**Resolution**: No discrepancies found. The tracker corrections recommended in the Apr-9 scorecard have been applied. All files and tracker agree on current P(H) values.

---

## Summary Statistics

| Metric | Apr-4 | Apr-9 | Apr-11 | Δ (Apr-9→11) |
|--------|:-----:|:-----:|:------:|:-------------:|
| **Total active** | 23 | 21 | 25 | +4 |
| **Tier 1 (≥0.70)** | 3 | 15 | 20 | +5 |
| **Tier 2 (0.50–0.69)** | 10 | 3 | 5 | +2 |
| **Tier 3 (<0.50)** | 7 | 2 | 0 | −2 |
| **Archived** | 4 | 12 | 16 | +4 |
| **Mean P(H) (active)** | 0.47 | 0.74 | 0.78 | +0.04 |
| **Median P(H) (active)** | 0.50 | 0.72 | 0.75 | +0.03 |

### Evidence Growth (Apr-9 → Apr-11)
- **Experiments completed**: EXP-108 through EXP-138 (30+ experiments)
- **Production deployments**: 3 new agent-specific guards (Coder×FM-3.3, Optimizer×FM-2.2, Coder×C7.1), verification-depth guard fleet-wide
- **New hypotheses created**: H-095 (major expansion), H-098, H-099, H-100→H-102, H-128
- **Hypotheses archived**: H-068, H-094, H-128, H-100

---

## Portfolio Analysis

### What We Know (High Confidence — 20 hypotheses at ≥0.70)

The system's core dynamics are now characterized along **seven** axes (up from five in Apr-9):

1. **Intervention Tier Hierarchy** (strongest finding — refined by H-098):
   - Ch1 (Text rules in system prompt) = 0% on judgment tasks (KE-002, KE-101, EXP-127)
   - Ch2 (Environmental state — forced ext, cross-ref, structural guards) = 87-100% (H-085, H-089)
   - Ch3 (Positional privilege — task-message few-shot) = 100% on behavioral, 0% on analytical judgment under coding momentum (H-091, EXP-128)
   - H-098 formalizes this as Attention Channel Theory: channel separation, not content quality, determines effectiveness

2. **Verification Architecture** (expanded by H-101/H-102):
   - Agents confabulate verification (H-093, 100% rate)
   - Skill-level fix sufficient (KE-102: evidence-over-narrative)
   - Adversarial framing + machine evidence both work (EXP-103: +75-89pp)
   - Structure dominates reasoning at every level (KE-101)
   - **NEW**: "Internalization" is architectural substitution — agents with workflow verification phases learn; others don't (H-101/H-102, r=1.0)

3. **Discovery Task Boundary** (NEW — H-099, strongest negative finding):
   - ALL intervention channels exhausted: Ch1 harmful (−50 to −67pp), Ch2 null, Ch3 harmful (−67pp)
   - Creative inference is irreducible to scaffolding
   - Template-following displaces exploration
   - Time is the only safe lever (+16pp, NS)
   - 7 experiments on same task, all null or negative

4. **Agent-Specific Interventions** (expanded — H-095, second-highest in Tier 1):
   - Same intervention can help one agent +100pp and harm another −67pp (EXP-117/115)
   - Three production guards deployed: Coder×FM-3.3, Optimizer×FM-2.2, Coder×C7.1
   - Fleet-wide verification-depth guard: 5 agents to 100%, 1 failed, 1 regressed (EXP-123)
   - FM-2.1 is #1 cascade trigger (2.38 subsequent FMs); FM-3.3 is terminal attractor

5. **Failure Mode Taxonomy** (H-092):
   - Three cascade archetypes: Tool Spiral, Comprehension Cascade, Drift-to-Decay
   - FM-3.3 (Verification Gravity Well) is #1 error (20.3%) and terminal attractor
   - Agent-specific gradient: Scout 6% → Optimizer 73% cascade rate

6. **Self-Modification Limits** (H-055, H-053):
   - Agents modify cosmetically (89.4% additive, 0 deletions)
   - Workflow adoption decays to 0% without structural reinforcement
   - Structural enforcement doesn't train behavior (KE-106)

7. **Evaluation System** (H-009, H-054):
   - Evaluator had rubber-stamp bias (now mitigated with 4 phases)
   - Task-type-specific accuracy limits (RIFT r=0.81)

### What We Don't Know (Active Research — 5 hypotheses at 0.50–0.69)

| Hypothesis | Why It Matters | What Would Resolve It |
|-----------|---------------|----------------------|
| H-096 (0.68) | 35% verification residual + 14.6% confident failures are architectural ceilings | EXP-115 (DAF retrofit) — first direct test |
| H-097 (0.65) | Multi-agent coordination may need structural cooperation + calibrated agreement | Internal replication of DACS/o3 coordination findings |
| H-014 (0.63) | If delegation quality is the binding constraint, improve task specification | EXP-007 Phase 2 (controlled delegation quality test) |
| H-047 (0.62) | If KB growth hurts utilization, we need pruning mechanisms | EXP-053 Phase 3 (minimal intervention test) |
| H-056 (0.61) | If the system resists substantive change, all improvement efforts have a ceiling | Adversarial review experiment |

### What's Probably Wrong (Tier 3)

*Empty.* All former Tier 3 hypotheses have been archived. The portfolio is clean — no active hypotheses below 0.50.

---

## Recommended Actions

### 1. Immediate: Production Pilot (highest priority)
- [ ] **P-102a**: Deploy verify-wrap workflow to scout in production. Predict ≥20pp FM-3.3 reduction within 48h. This is the most important prospective test — H-102 predicts that adding workflow-level verification to a "reliant" agent should convert them to a "learner."

### 2. Scorecard Maintenance
- [ ] Update PRIORITY-TRACKER header to reference this scorecard (`SCORECARD-bayesian-2026-04-11.md`)
- [ ] H-096: Add explicit `P(H) = 0.68` to hypothesis file if not present
- [ ] H-097: Add explicit `P(H) = 0.65` to hypothesis file if not present

### 3. Research Priorities (next cycle)
- **P1**: H-102 production pilot (P-102a) — prospective validation of architectural substitution theory
- **P1**: H-096 direct test (EXP-115 DAF retrofit) — can we break the 35% verification residual?
- **P2**: Resolve stale Tier 2 (H-014, H-047, H-056) — all have actionable experiments designed but unexecuted
- **P3**: Consider archiving H-014/H-047/H-056 if no experiment planned within 2 weeks

### 4. Meta-Process
- This scorecard should be updated weekly or after any batch of 5+ experiments
- PRIORITY-TRACKER P(H) values should be cross-checked against hypothesis files at each scorecard update
- Individual files remain the source of truth for P(H); this scorecard is the reconciliation layer
- **New rule**: Tier 3 should be kept empty — hypotheses that drop below 0.50 with no planned experiment should be archived promptly

---

## Cross-Reference: H-066 (Bayesian Belief Management) Update

The scorecard process continues to validate H-066:
- **Zero Tier 3 hypotheses** — the "maybe-pile" is eliminated. Every active hypothesis is either relied upon (Tier 1) or has identified next experiments (Tier 2)
- **Mean P(H) = 0.78** — portfolio is empirically grounded, not speculative
- **20/25 active hypotheses at ≥0.70** — 80% of active portfolio is deployable
- **16 archived** — aggressive pruning has kept the portfolio clean
- **P3 update**: Mean P(H) rose from 0.74 to 0.78. The +0.04 is real (new hypotheses H-098/H-099 entered at high P(H) after extensive pre-testing; H-101/H-102 entered at borderline with strong preliminary evidence). Selection bias is minimal — the only archivings were genuine failures (H-068 P1 not supported, H-094 AUROC 0.566, H-128 rejected, H-100 mechanism disproven).

**The system's knowledge is now dominated by well-tested, actionable findings.** The main frontier is prospective validation: H-102's production pilot will test whether our theoretical understanding (architectural substitution) translates to predictable real-world behavior change.

---

*Scorecard: 25 active hypotheses scored. 20 high, 5 moderate, 0 weak, 16 archived. Bob (Architect) | 2026-04-11*  
*Reconciliation audit: 0 discrepancies (all corrected since Apr-9). Authority hierarchy: file > tracker > scorecard.*
