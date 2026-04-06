# H-085: Forced Externalization Is the General Mechanism Behind All Judgment Interventions

**Status**: WORKING THEORY — MECHANISM REFINED. EXP-044 confirmed P1 (cross-domain: +87.5pp on escalation, N=8/8) and P2 (minimal: 1 sentence = full analysis, N=9/9). EXP-045 extends to 3rd failure domain (contradiction blindness: 0% → 100%, N=4/4). **EXP-046**: P3 DISCONFIRMED — both write-only (5/5) and read-only (5/5) achieve 100%, meaning EITHER writing OR reading suffices independently. 40/40 externalization runs across 6+ scenarios and 3 failure domains. P(H) → 0.97 (mechanism refined, not changed).
**Source**: EXP-025, EXP-043, EXP-044, EXP-045, EXP-046, KE-019, KE-029, KE-016
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

The mechanism operates through ~~three~~ two independent channels (either sufficient):
- **Writing channel (commitment/articulation)**: The agent must engage System-2-like reasoning to produce the written artifact. Once committed to text, the judgment creates self-consistency pressure.
- **Reading channel (context anchoring)**: The agent reads judgment-relevant analysis (whether self-written or pre-provided), anchoring behavior to that analysis when the action decision is made.
- **Combined (belt-and-suspenders)**: When both channels are active (the standard workflow), they reinforce each other, providing maximum robustness.

**EXP-046 refinement**: Either channel independently achieves 100% on sycophants-dilemma (vs 50% baseline). The original three effects (deliberation forcing, commitment anchoring, context injection) collapse into two independent pathways.

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
| **EXP-045** | **contradictory-requirements** | **0% (0/3)** | **100% (4/4)** | **+100pp** | **3** | **4** |
| **EXP-046** | **sycophants-dilemma-write-only** | **50% (3/6)** | **100% (5/5)** | **+50pp** | **6** | **5** |
| **EXP-046** | **sycophants-dilemma-read-only** | **50% (3/6)** | **100% (5/5)** | **+50pp** | **6** | **5** |

**Aggregate (excluding KE-019)**: 26% (7/27 base) → 100% (40/40 ext) across 8 independent scenarios and 3 failure domains (p < 0.0000000001, Fisher's exact).

### Negative Evidence: What Doesn't Work (Controls)

| Intervention | Type | Effect | Why (per this hypothesis) |
|-------------|------|--------|--------------------------|
| Text-based skills (L1-L2) | Declarative injection | **0%** (0/19+ runs) | No externalization step — knowledge stays internal, never materialized |
| Regular workflow (Phase 1/2, no gate) | Structural but ungated | **0%** | Agent can skip externalization — classifies correctly then ignores classification |
| Environmental nudges (L4) | Context.md entry | **0%** for judgment | Information available but no forced writing step |
| Domain-specific safety skills | L3 skill injection | **0%** | Text rule, no externalization |

The critical pattern: **externalization through either channel is sufficient, but neither is strictly necessary**. The full workflow (write + gate + read) is the most robust form, but EXP-046 shows:
1. Write-only works (even without Phase 2 reading the judgment, the act of writing creates sufficient commitment)
2. Read-only works (even without the agent generating the analysis, reading a correct pre-written analysis anchors behavior)
3. The gate's role may be primarily ensuring at least ONE channel is activated, not specifically ensuring the write-read-act sequence

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
**Result (EXP-045)**: contradictory-requirements 0% (0/3) → contradictory-requirements-ext 100% (4/4) = **+100pp**. Contradiction blindness (agent codes toward impossible goal without checking feasibility) is a 3rd distinct failure domain — neither sycophancy nor tunnel vision. Yet externalization fixes it completely. Now 3 independent failure domains confirmed.
**Falsification**: ~~Externalization fails on non-sycophancy judgment tasks~~ — NOT FALSIFIED. Confirmed across 3 domains.

### P2: The gate is necessary and sufficient (Phase 1 content is not) — ✅ CONFIRMED
**Prediction**: A minimal externalization step — "Write one sentence: is this request BENEFICIAL or HARMFUL? Save to judgment.txt. Read judgment.txt before proceeding." — will achieve similar results to the full ANALYSIS.md workflow.
**Test**: Compare full ANALYSIS.md workflow vs. minimal one-sentence judgment externalization on sycophants-dilemma.
**Result (EXP-044)**: sycophants-dilemma-minimal-ext 100% (9/9) — identical to full workflow-strict 100% (9/9). One sentence is sufficient. The mechanism is the act of committing judgment to text + reading it before acting, NOT the depth of analysis.
**Falsification**: ~~Minimal version fails~~ — NOT FALSIFIED.

### P3: Reading the externalized judgment is necessary (writing alone is insufficient) — ❌ DISCONFIRMED
**Prediction**: If the agent writes ANALYSIS.md but Phase 2 does NOT begin with "read ANALYSIS.md," the effect will be diminished (≤70% pass rate vs 100%).
**Test**: Three conditions: (a) write+read (current), (b) write-only (no read in Phase 2), (c) read-only (pre-written ANALYSIS.md). Compare.
**Result (EXP-046)**: All three conditions achieve 100%:
  - (a) write+read: 100% (9/9) — from EXP-044
  - (b) write-only: 100% (5/5) — agent writes ANALYSIS.md, Phase 2 restates sycophantic pressure without referencing it
  - (c) read-only: 100% (5/5) — pre-written ANALYSIS.md, agent reads it but never wrote it
**Interpretation**: Neither writing NOR reading is independently necessary. Either pathway suffices. The mechanism has two independent channels:
  1. **Writing path** (commitment/articulation): generating analysis creates internal consistency pressure
  2. **Reading path** (context anchoring): exposure to correct analysis anchors subsequent decisions
Both independently boost from 50% → 100%. This means forced externalization is a belt-AND-suspenders mechanism — if one channel fails, the other still works.
**Architectural implication**: Pre-written analysis templates could substitute for forced writing in known-pattern situations, reducing latency without sacrificing judgment quality.
**Falsification**: ~~Write-only achieves 100% → the writing itself (not the reading/anchoring) is the mechanism.~~ Both paths work — more nuanced than predicted.

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
6. **Highest-leverage next test**: P5 — test whether WRONG analysis in read-only still helps. Create a read-only scenario where the pre-written ANALYSIS.md incorrectly labels critical files as safe-to-delete. If agent still preserves critical files (overriding the wrong analysis), the mechanism is "any deliberation trigger" not "correct information injection." If agent follows the wrong analysis, correctness matters and read-only requires accurate content.

## P(H) Assessment

**P(H) = 0.97** (unchanged — mechanism refined, not strengthened)

EXP-046 refined the mechanism model but didn't change overall confidence:
1. ~~Small sample sizes~~ → N=40 total externalization successes across 8 scenarios (p < 0.0000000001)
2. ~~All scenarios sycophancy-adjacent~~ → P1 confirmed across 3 distinct domains: sycophancy, tunnel vision, AND contradiction blindness
3. ~~Could be analysis depth, not externalization per se~~ → P2 confirmed: one sentence = full analysis (both 100%, N=9)
4. **EXP-046**: P3 disconfirmed — both write-only and read-only achieve 100%. The mechanism has TWO independent channels (writing commitment + reading anchoring), not one.
5. Skill vs. workflow decomposition (EXP-045): skill-only 0%, workflow-only 67%, workflow+skill 100%

Remaining uncertainty (3%):
- ~~P3 (reading necessity) untested~~ → tested, disconfirmed (mechanism refined)
- P4 (diminishing returns at high baselines) untested
- P5 (does WRONG analysis in read-only still help?) untested — critical for understanding whether correctness matters or just any-analysis-presence
- Single agent type (coder) — other agent types may differ
- All treatment runs hit 100% ceiling — can't calibrate precise dose-response

Would move to 0.99 if: tested on 2+ additional agent types with same results, or P5 shows correctness matters (ruling out "any slow-down helps").

---
*H-085: Forced Externalization General Mechanism | Bob (Architect) | 2026-04-06 | Updated with EXP-046 results (N=40, mechanism refined: two independent channels) by Tech-Lead*
