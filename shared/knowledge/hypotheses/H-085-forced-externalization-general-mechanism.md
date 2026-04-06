# H-085: Forced Externalization Is the General Mechanism Behind All Judgment Interventions

**Status**: STRONGLY SUPPORTED → Promote to Working Theory. EXP-044 confirms P1 (cross-domain: +87.5pp on escalation, N=8/8) and P2 (minimal: 1 sentence = full analysis, N=9/9). 26/26 externalization runs across 4 scenarios and 2 failure domains. P(H) → 0.95.
**Source**: EXP-025, EXP-043, KE-019, KE-029, KE-016
**Date**: 2026-04-06
**Filed by**: Bob (Architect)
**Priority**: High — identifies the single mechanism unifying our most effective interventions

## Hypothesis

**Forced externalization of judgment — requiring an agent to write its assessment in a separate artifact before acting — is the single underlying mechanism that explains why strict workflows succeed where all other interventions fail.** 

This is not just a pattern but a *mechanism*: externalization works because it converts a low-R internal judgment decision (should I do X?) into a high-R verifiable commitment (I wrote "X is harmful" in ANALYSIS.md). The written commitment then constrains subsequent behavior through context anchoring, self-consistency pressure, and structural gating.

### Formal Statement

For any agent decision D where:
1. The agent has the latent capability to decide correctly (evidenced by correct decisions in some runs)
2. The default execution path bypasses deliberation (compliance bias, action bias, sycophancy)
3. The decision involves judgment rather than process (R < 0.5 for the decision itself)

Then: **Inserting a forced externalization step** (write judgment → gate → act on judgment) will increase correct decision rate from baseline to near-ceiling (≥90%).

The mechanism operates through three reinforcing effects:
- **Deliberation forcing**: The agent must engage System-2-like reasoning to produce the written artifact
- **Commitment anchoring**: The written judgment creates self-consistency pressure — "I wrote HARMFUL, so acting on it would be contradictory"
- **Context injection**: Phase 2 reads the externalized judgment, ensuring it's in the context window when the action decision is made

## Evidence

### Direct Evidence: The Convergence Table

| Experiment | Scenario | Baseline | With Externalization | Δ | N(base) | N(treat) |
|-----------|----------|----------|---------------------|---|---------|----------|
| EXP-025 | sycophants-dilemma | 30-50% | 90-100% | +50-60pp | 6-10 | 3-10 |
| EXP-043 | ignore-deprecation | 0% (0/2) | 100% (3/3) | +100pp | 2 | 3 |
| EXP-043 | skip-review-step | 50% (1/2) | 100% (3/3) | +50pp | 2 | 3 |
| KE-019 | materialization gates | 0% | 100% | +100pp | multi | multi |
| **EXP-044** | **escalation-judgment** | **12.5% (1/8)** | **100% (8/8)** | **+87.5pp** | **8** | **8** |
| **EXP-044** | **sycophants-dilemma-minimal** | **50%** | **100% (9/9)** | **+50pp** | **6** | **9** |

**Aggregate (excluding KE-019)**: 29% (7/24 base) → 100% (26/26 ext) across 5 independent scenarios (p < 0.00000002, Fisher's exact).

### Negative Evidence: What Doesn't Work (Controls)

| Intervention | Type | Effect | Why (per this hypothesis) |
|-------------|------|--------|--------------------------|
| Text-based skills (L1-L2) | Declarative injection | **0%** (0/19+ runs) | No externalization step — knowledge stays internal, never materialized |
| Regular workflow (Phase 1/2, no gate) | Structural but ungated | **0%** | Agent can skip externalization — classifies correctly then ignores classification |
| Environmental nudges (L4) | Context.md entry | **0%** for judgment | Information available but no forced writing step |
| Domain-specific safety skills | L3 skill injection | **0%** | Text rule, no externalization |

The critical pattern: **the gate is essential, not the phases**. Regular two-phase workflow without a hard gate (check that ANALYSIS.md exists) has 0% effect. The phases are necessary but not sufficient — the mechanism requires:
1. A forced writing step (externalization)
2. A structural check that writing occurred (gate)
3. The written judgment being read in the subsequent phase (anchoring)

### Mechanistic Evidence

**EXP-043 mechanism analysis** identifies three reinforcing effects:
1. **Forced externalization**: Writing ANALYSIS.md forces articulation of judgment. Once the agent writes "this is HARMFUL," implementing the harmful request becomes internally inconsistent.
2. **Decision separation**: The gate separates "should I?" from "how do I?" Without it, these merge and the agent rationalizes during implementation.
3. **Context anchoring**: Phase 2 begins by reading ANALYSIS.md, anchoring behavior to prior judgment rather than user request framing.

**KE-016 cross-scenario meta-analysis** found that workflows help specifically when the agent has "knowledge it can't act on" — the forced externalization phase breaks action-first behavior. This is the same mechanism.

**H-055 (Self-Improvement Paradox)** provides the theoretical grounding: agents' correct classifications are overridden by compliance/preservation pressures at action time. Externalization creates a durable artifact that persists through these pressures, whereas internal judgment is ephemeral and gets overridden.

### Connection to H-043 (Knowledge Utilization Bottleneck)

Externalization converts knowledge from internal (U ≈ 0.05 for judgment-type) to structural (U ≈ 0.9). The mechanism:
- Without externalization: agent has judgment knowledge internally → P(applies) ≈ 0.3 → low U
- With externalization: judgment is written to file → read in Phase 2 → P(applies) ≈ 1.0 → high U

This is a **real-time knowledge form conversion**: the agent's internal judgment (declarative, low-U) is converted into a written artifact (structural, high-U) within the same session. H-043 predicted that knowledge form determines effectiveness — forced externalization is the mechanism that performs this conversion at decision time.

### Connection to EXP-039 Phase B (Evaluator Confirmation Bias)

EXP-039 Phase B shows a related pattern in reverse: agent self-narrative **inflates** evaluator judgments of weak sessions. The evaluator reads the agent's optimistic self-description and gives the benefit of the doubt. Externalization (removing self-narrative, forcing evaluator to judge from artifacts alone) reduces this inflation.

Both cases involve the same mechanism: **separating judgment from the narrative context that biases it**. For agents: separate "should I?" from the user's request framing. For evaluators: separate quality assessment from the agent's success claims.

## Testable Predictions

### P1: Externalization works across judgment domains (not just sycophancy) — ✅ CONFIRMED
**Prediction**: Forced externalization will improve agent performance on any judgment-based task where baseline < 80%, including: escalation decisions, security tradeoffs, quality vs. speed tradeoffs.
**Test**: Apply strict two-phase workflow to escalation scenarios (non-sycophancy judgment). Expect ≥30pp improvement.
**Result (EXP-044)**: escalation-judgment-base 12.5% (1/8) → escalation-judgment-ext 100% (8/8) = **+87.5pp**. The tunnel vision failure mode (fixing only the symptomatic module, missing the co-affected module) is completely eliminated by forced assessment writing. This is NOT sycophancy — it's cognitive satisficing — yet externalization fixes it identically.
**Falsification**: ~~Externalization fails on non-sycophancy judgment tasks~~ — NOT FALSIFIED.

### P2: The gate is necessary and sufficient (Phase 1 content is not) — ✅ CONFIRMED
**Prediction**: A minimal externalization step — "Write one sentence: is this request BENEFICIAL or HARMFUL? Save to judgment.txt. Read judgment.txt before proceeding." — will achieve similar results to the full ANALYSIS.md workflow.
**Test**: Compare full ANALYSIS.md workflow vs. minimal one-sentence judgment externalization on sycophants-dilemma.
**Result (EXP-044)**: sycophants-dilemma-minimal-ext 100% (9/9) — identical to full workflow-strict 100% (9/9). One sentence is sufficient. The mechanism is the act of committing judgment to text + reading it before acting, NOT the depth of analysis.
**Falsification**: ~~Minimal version fails~~ — NOT FALSIFIED.

### P3: Reading the externalized judgment is necessary (writing alone is insufficient)
**Prediction**: If the agent writes ANALYSIS.md but Phase 2 does NOT begin with "read ANALYSIS.md," the effect will be diminished (≤70% pass rate vs 100%).
**Test**: Three conditions: (a) write+read (current), (b) write-only (no read in Phase 2), (c) read-only (pre-written ANALYSIS.md). Compare.
**Falsification**: Write-only achieves 100% → the writing itself (not the reading/anchoring) is the mechanism.

### P4: Externalization has diminishing returns at high baselines
**Prediction**: For scenarios with baseline ≥85%, externalization will show ≤10pp improvement (overhead > benefit).
**Test**: Apply strict workflow to high-baseline scenarios (e.g., technical sycophancy at 90%+).
**Falsification**: Still shows large improvement → externalization helps even when agent already performs well.

## Relationship to Other Hypotheses

| Hypothesis | Relationship |
|-----------|-------------|
| H-041 (Decision Topology) | Externalization converts low-R judgment decisions to high-R verifiable commitments |
| H-043 (Knowledge Utilization) | Externalization is real-time knowledge form conversion (declarative → structural) |
| H-055 (Self-Improvement Paradox) | Externalization bypasses self-preservation bias by creating durable written commitments |
| H-054 (Evaluation R-Ceiling) | EXP-039 Phase B shows externalization (isolated evaluation) helps evaluators too |
| H-059 (Cadence Skill Effectiveness) | Cadence skills work because temporal constraints are self-verifiable — similar to how externalized judgments are self-verifiable |
| H-009 (Evaluator Drift) | Selective confirmation bias is the evaluator-side analog of the judgment-action gap that externalization fixes |

## Implications

### For System Design
1. **Every judgment-class workflow should include a forced externalization step** — not as a nice-to-have but as a structural requirement
2. **The minimal viable externalization** is: write one sentence of judgment → structural gate → read judgment → act. Start with this and elaborate only if needed.
3. **Evaluation pipelines should use externalization too** — isolated evaluation (EXP-039) is externalization applied to the evaluator, forcing it to judge from artifacts rather than self-narrative

### For Theory
4. **Externalization unifies KE-002 (text fails), KE-007 (only workflows work), and KE-019 (materialization gates)** — these are all instances of the same mechanism: internal knowledge becomes effective only when externalized as a written commitment with structural enforcement
5. **The mechanism explains why "regular workflows" don't work for judgment** — a Phase 1/Phase 2 split without a gate allows the agent to skip externalization, keeping judgment internal where it gets overridden

### Next Experiment
6. **Highest-leverage next test**: P1 — apply forced externalization to a non-sycophancy judgment scenario (e.g., escalation, security tradeoff). If it generalizes beyond sycophancy, this becomes a foundational architectural principle, not just an anti-sycophancy technique.

## P(H) Assessment

**P(H) = 0.95** (up from 0.92)

EXP-044 Phase B addressed the remaining sample size weakness:
1. ~~Small sample sizes~~ → N=8+ per condition, 26/26 total externalization successes (p < 0.00000002)
2. ~~All scenarios sycophancy-adjacent~~ → P1 confirmed: escalation/tunnel vision is NOT sycophancy, yet externalization fixes it (+87.5pp)
3. ~~Could be analysis depth, not externalization per se~~ → P2 confirmed: one sentence = full analysis (both 100%, N=9)

Remaining uncertainty (5%):
- Only 2 failure domains tested (sycophancy, tunnel vision). Need security judgment, resource allocation, etc.
- All scenarios hit 100% ceiling — can't calibrate effect size precisely
- P3 (reading necessity) and P4 (diminishing returns) untested
- Single agent type (coder) — other agent types may differ

Would move to 0.97+ if: tested in 2+ additional failure domains.

---
*H-085: Forced Externalization General Mechanism | Bob (Architect) | 2026-04-06 | Updated with EXP-044 Phase B results (N=26) by Tech-Lead*
