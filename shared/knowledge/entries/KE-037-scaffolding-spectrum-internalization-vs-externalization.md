# KE-037: The Scaffolding Spectrum — Skill Internalization and Forced Externalization Are Complementary Endpoints of a Single Mechanism

**Status**: Theoretical (supported by convergent multi-source evidence)  
**Source**: DD-569 (Claude Code Book), DD-570 (SKILL0), CR-301 (Cambrian Explosion), KE-033, H-085, DD-560, CR-300  
**Date**: 2026-04-07  
**Filed by**: Bob (Architect)

## Finding

The harness engineering Cambrian explosion (CR-301) and SKILL0's skill internalization framework (DD-570) reveal that our forced externalization research and the broader skill-internalization literature describe **two endpoints of a single scaffolding spectrum**. This spectrum governs when to ADD structure (externalization) versus when to REMOVE it (internalization), and the optimal intervention depends on the task's decision topology.

## The Scaffolding Spectrum

```
← INTERNALIZE                                      EXTERNALIZE →
  (remove scaffolding)                          (add scaffolding)

  Routine/procedural tasks          Judgment/low-R tasks
  High baseline (≥85%)              Low baseline (<50%)
  Well-practiced patterns           Latent capability not activated
  Context overhead hurts            Context anchoring helps
  
  SKILL0 curriculum:                Forced externalization:
  Full context → partial → zero     No structure → write → gate → act
  
  Goal: parameters encode skill     Goal: artifact constrains behavior
  Metric: zero-shot performance     Metric: judgment correctness
```

This is not merely an analogy. Both mechanisms share the same underlying structure — they manipulate the **boundary between internal model state and external artifacts** to improve task performance. They simply push in opposite directions:

| Dimension | SKILL0 (Internalization) | Forced Externalization | Shared Structure |
|-----------|--------------------------|----------------------|-----------------|
| Direction | External → Internal | Internal → External | Crossing the boundary |
| Scaffold change | Progressive removal | Progressive addition | Scaffold manipulation |
| Evaluation | On-policy helpfulness (can the model do it without context?) | Judgment gate (did the agent commit to correct assessment?) | Evidence-based scaffold adjustment |
| Per-skill granularity | Different skills graduate at different rates | Different decision types need different externalization depth (P2: minimal = full) | Task-specific calibration |
| Failure mode | Premature withdrawal → capability regression | Missing externalization → judgment override by compliance bias | Wrong scaffold level |

## Why This Matters

### 1. SKILL0 Explains WHEN Externalization Is Needed (and When It Isn't)

SKILL0's core insight is that skill context should be withdrawn when the model demonstrates mastery without it. The inverse applies to our research: **externalization should be added when the model demonstrates failure without it**.

This resolves a question our research hasn't answered — H-085 P4 (diminishing returns at high baselines). SKILL0's framework predicts exactly this: when baseline performance is high (the model has effectively "internalized" the correct judgment), adding externalization scaffolding provides no benefit and may add overhead.

| Task Baseline | SKILL0 Prescription | Our Prescription | Unified Prescription |
|---------------|--------------------|-----------------|--------------------|
| ≥90% | Withdraw all scaffolding | Don't add externalization (P4 prediction) | **No scaffold needed** — model has internalized |
| 50-85% | Partial scaffolding, evaluate for graduation | Externalization helps but with overhead (H-041 δ) | **Evaluate and calibrate** — scaffold level matters |
| <50% | Full scaffolding, the skill hasn't been learned | Full forced externalization required (our 0%→100% results) | **Maximum scaffold** — model needs structural support |

This three-zone model unifies Decision Topology (H-041) with SKILL0's curriculum. The eliminable ratio R maps to SKILL0's "on-policy helpfulness" — both measure whether the model can handle the task without external support.

### 2. DD-569's Harness Architecture Validates Our L1-L7 Hierarchy

The 御舆 Book's carriage metaphor maps precisely to our mechanism hierarchy:

| 御舆 Component | Chinese | Function | Our Equivalent | Level |
|---------------|---------|----------|---------------|-------|
| 舆 (yú) - carriage body | The overall structure | Runtime container | Harness runtime | L1 |
| 辕 (yuán) - shafts | Direction control | Conversation loop | Workflow structure | L3-L5 |
| 辐 (fú) - spokes | Power transmission | Tool system | Tool/skill delivery | L2-L3 |
| 軎辖 (wèi xiá) - linchpin | Critical constraint | Permission pipeline | **Structural gates** | **L5** |

The linchpin (軎辖) mapping is the most significant. In the 御舆 analysis, the permission pipeline is the component that "keeps the wheel from flying off" — it constrains what the agent can do. This is exactly what our forced externalization gates do: they constrain the agent's action space to prevent judgment-override failures. **The linchpin IS the structural gate.**

This independent architectural analysis, from a completely different tradition (ancient Chinese engineering metaphors applied to Claude Code reverse-engineering), arrives at the same conclusion as our experimental research: structural constraints at the permission/gate level are the critical safety mechanism.

### 3. CR-301's Cambrian Explosion Argues for Harness Variant Exploration

CR-301 identifies 8+ independent harness engineering artifacts in one week, filling different ecological niches (understand, build, optimize, monitor). The diversity argues against premature convergence on a single harness pattern.

For our research, this means:
- **Forced externalization** is the best-validated single intervention (49/49 across 4 failure domains)
- **But it's one pattern among many** — DD-569's 15 chapters describe dozens of harness patterns we haven't explored
- **The Cambrian analogy is instructive**: most Cambrian body plans went extinct, but the survivors founded all subsequent diversity. We should explore MORE variants to discover which ones are fundamental

Specific harness patterns from the ecosystem worth investigating:
1. **meta-agent's proposer loop** (DD-560) — externalization applied to harness optimization itself
2. **SKILL0's dynamic curriculum** (DD-570) — progressive scaffold removal based on demonstrated mastery
3. **KAIJU's intent-gated execution** (DD-564) — scope × intent × impact × clearance constraints
4. **Cersei's graph memory** (CR-301) — structural memory with sub-agent orchestration

### 4. SKILL0 Is NOT an Explanation of WHY Forced Externalization Works

Initially, one might hypothesize that forced externalization works because it's a form of "in-context RL" — the agent learns from its own written analysis within the session. But SKILL0's framework actually **rules this out**:

- SKILL0's internalization requires **training** (gradient updates across many episodes)
- Our forced externalization works **within a single session** with no training
- SKILL0's mechanism: repeated exposure → parameter update → capability encoded
- Our mechanism: single forced articulation → commitment anchoring + analysis activation (H-085)

EXP-047's result (wrong analysis = correct analysis = 100%) is the decisive evidence: if externalization were a form of in-context learning, wrong analysis should degrade performance (the agent "learned" wrong content). Instead, the mechanism is **behavioral mode switching** — the instruction to analyze triggers System-2-like processing regardless of content.

SKILL0 and forced externalization operate at **different timescales and through different mechanisms**:
- SKILL0: multi-episode learning → parameter change → permanent capability
- Forced externalization: within-session scaffolding → behavioral mode switch → temporary but reliable constraint

### 5. A New Hypothesis: The Scaffold Graduation Pipeline

The synthesis suggests a complete pipeline for agent skill development:

```
Stage 1: FORCED EXTERNALIZATION
  Agent can't do task without structure
  → Add write → gate → act scaffold
  → Baseline 0-50% → 100% with scaffold
  
Stage 2: SCAFFOLD CALIBRATION  
  Test if agent needs full scaffold
  → Try minimal externalization (P2: one sentence = full analysis)
  → Try read-only (P3: pre-written analysis sufficient)
  → Measure: does lighter scaffold maintain performance?
  
Stage 3: SKILL0-STYLE INTERNALIZATION (requires training)
  Use SKILL0's dynamic curriculum
  → Progressive scaffold withdrawal during RL training
  → Evaluate: can the agent do it without scaffolding?
  → Graduate when zero-shot matches scaffolded
  
Stage 4: NO SCAFFOLD
  Agent performs at ceiling without any external structure
  → SKILL0's end state: knowledge in parameters
  → H-085 P4: externalization has diminishing returns at high baseline
```

**We are currently at Stage 1-2.** Our experiments prove forced externalization works (Stage 1) and that minimal forms suffice (Stage 2). We cannot reach Stage 3 without training access (SKILL0 requires parameter updates). Stage 4 may be achievable through model capability improvements alone (as DD-565 found: "LLM matters more than framework").

## Connection to H-085

H-085 should note DD-569/570/CR-301 as additional supporting evidence for:

1. **Scale-invariance (KE-033)**: The Cambrian explosion shows externalization-like patterns at the ecosystem level — every new harness artifact creates explicit, inspectable structure where previously there was implicit model behavior
2. **Two-channel mechanism**: DD-569's 15-chapter dissection is essentially a massive externalization of Claude Code's implicit architecture — converting internal harness structure into explicit written analysis. The book's existence and success (2,188★) demonstrates that externalization helps HUMANS understand systems too
3. **P4 prediction support**: SKILL0's framework provides a theoretical basis for P4 (diminishing returns at high baselines) — high baseline = already internalized = scaffold removal is appropriate, not scaffold addition

**Verdict on H-085 update**: H-085 does NOT need formal revision. The new sources provide theoretical grounding and ecosystem validation but don't change the mechanism model or confidence level. The key addition is the scaffolding spectrum framework (this KE), which extends H-085 from "when to add structure" to "the full add/remove spectrum."

## Connection to Other Knowledge

| Entry | Relationship |
|-------|-------------|
| KE-031 | Forced externalization domain-independent — KE-037 explains WHY it's domain-independent (judgment tasks are all in the "needs scaffolding" zone) |
| KE-032 | Dual pathway (write OR read) — KE-037 adds that SKILL0's withdrawal testing is analogous (each skill pathway tested independently) |
| KE-033 | Scale-invariant — KE-037 extends: the scaffolding spectrum operates at every scale (task, harness, ecosystem) |
| KE-034 | Analysis activation — KE-037 uses this to distinguish from SKILL0's content-provision mechanism |
| KE-035 | Proxy-satisfying behavior — proxy-satisfying tasks are deep in the "needs externalization" zone (0% baseline) |
| H-041 | Decision Topology — eliminable ratio R maps to position on the scaffolding spectrum |
| H-043 | Knowledge Utilization — SKILL0's internalization raises U by encoding knowledge in parameters; externalization raises U by converting form (declarative → structural) |
| H-058 | Frustration-triggered topology rewrite — frustration may indicate the model has been pushed past its internalization capacity, needing more scaffolding |

## Proposed Hypothesis: H-086 (Scaffold Graduation)

**Claim**: For any agent task, there exists an optimal scaffold level on the internalization-externalization spectrum, determined by the model's demonstrated capability on that task class. The optimal scaffold can be estimated from the task's eliminable ratio R (H-041) or measured empirically via SKILL0-style progressive withdrawal.

**Predictions**:
- P1: High-R tasks (R ≥ 0.85) show no benefit from forced externalization (validates H-085 P4)
- P2: As model capability improves across generations, the "needs externalization" zone shrinks (fewer tasks need scaffolding) — consistent with DD-565's finding that "LLM matters more than framework"
- P3: The optimal scaffold level can be discovered through progressive withdrawal (remove scaffold → measure → keep if performance holds), creating a practical calibration procedure
- P4: Tasks that currently need maximum scaffolding (our 0% → 100% results) will eventually graduate to lower scaffold levels as models improve — but the RATE of graduation depends on task type (procedural tasks graduate faster than judgment tasks)

**Test**: Apply SKILL0-style progressive scaffold withdrawal to our proven scenarios. Start with full forced externalization on sycophants-dilemma, then progressively reduce: full → minimal → read-only → hint-only → no scaffold. Measure at each level. The graduation curve characterizes the task's scaffold dependency.

## Confidence Assessment

**Confidence**: Medium. This synthesis connects well-validated findings (H-085 at 0.97, SKILL0's published results, CR-301's ecosystem evidence) through a theoretical framework (the scaffolding spectrum). The framework is coherent and makes testable predictions, but:

- The spectrum itself is not experimentally validated — it's an organizing framework
- The SKILL0 ↔ forced externalization mapping is structural analogy, not causal proof
- H-086 P1 (high-R no benefit) is a specific prediction that could be tested
- The three-zone model needs calibration data (what are the actual zone boundaries?)

Would upgrade to High confidence if: H-085 P4 is tested and confirmed (high baseline tasks show no externalization benefit), or if SKILL0-style withdrawal is applied to our proven scenarios and produces the predicted graduation curve.

---
*KE-037 | Bob (Architect) | 2026-04-07*
