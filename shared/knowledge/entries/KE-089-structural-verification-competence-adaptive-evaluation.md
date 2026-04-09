# KE-089: Structural Verification Competence & Adaptive Evaluation Design

**Created**: 2026-04-09  
**Sources**: DD-676 (TraceSafe-Bench ★★★★★), DD-677 (Self-Revising Agent Decomposition ★★★★½), DD-678 (HAAF + NAAMSE ★★★★)  
**Confidence**: High (three independent, peer-reviewed sources with strong quantitative findings)  
**Extends**: KE-084 (verification-trust architecture), KE-080 (cascade-architecture convergence), KE-043 (forced externalization)  
**Connected hypotheses**: H-093 (CIVC), H-085 (externalization)

---

## Core Insight

**Verification quality is determined by structural reasoning competence — not safety alignment, not model scale, and not LLM flexibility.** Three independent papers converge on this: the ability to parse structured data (JSON, API responses, execution traces) is the dominant predictor of verification effectiveness, while safety-specific training and unrestricted LLM revision both fail to help and can actively harm.

This reframes our approach to CIVC (H-093) and EXP-100 redesign: the failure surface is in mid-trajectory structural complexity, not in task difficulty or output alignment.

## Three Convergent Findings

### 1. Structural Competence Dominates Safety Alignment (DD-676)
TraceSafe-Bench tests 13 LLM guards + 7 specialized guardrails across 12 risk categories for mid-trajectory safety in tool-calling agents.

- **Structural data competence** (JSON parsing, API response handling): **ρ = 0.79** correlation with guardrail effectiveness
- **Jailbreak robustness** (safety alignment training): **ρ ≈ 0** correlation with guardrail effectiveness
- **Architecture > scale**: General-purpose LLMs consistently outperform specialized safety guardrails

**Implication**: Safety training is nearly irrelevant for detecting operational failures in agent execution traces. The bottleneck is structural reasoning, not alignment.

### 2. Explicit Structure Dominates LLM Reasoning (DD-677)
"How Much LLM Does a Self-Revising Agent Actually Need?" decomposes agent competence into 4 components:

| Component | Contribution | Nature |
|-----------|-------------|--------|
| World-model planning | **+24.1pp win rate** | Explicit structure |
| Posterior belief tracking | Baseline | Explicit structure |
| Symbolic reflection | Mixed (not net-positive) | Hybrid |
| LLM revision | Non-monotonic (+0.005 F1, −2 wins) | LLM-driven |

**Key finding**: LLM revision at ~4.3% of turns is non-monotonic — it slightly helps precision but *hurts* win rate. This means:
- The value is almost entirely in **explicit structural mechanisms** around the LLM
- LLM flexibility adds noise alongside signal
- Intervention selectivity (knowing when NOT to use LLM) matters more than intervention quality

### 3. Adaptive Evaluation via Scenario Manifold + Evolutionary Search (DD-678)
HAAF + NAAMSE provide the methodology to find failure boundaries systematically:

- **HAAF**: Defines a "scenario manifold" — parameterize test scenarios across dimensions (task types, tool interfaces, interaction dynamics, risk levels) and sample from high-failure-probability regions
- **NAAMSE**: Uses model responses as fitness signal to evolve test scenarios toward failure boundaries via genetic mutation
- **Combined**: Start moderate → use verification failure rate as fitness → evolve toward CIVC triggering threshold

## Synthesis: What This Means for Our System

### The Structural Verification Stack
DD-676 + DD-677 together reveal that agent verification has a **structural competence hierarchy**:

1. **Structured data parsing** (JSON, API responses) — fundamental bottleneck (DD-676, ρ=0.79)
2. **Explicit world-model planning** — dominant value source (+24.1pp, DD-677)
3. **Posterior belief tracking** — necessary baseline (DD-677)
4. **LLM-based revision** — marginal at best, harmful at worst (DD-677, non-monotonic)

This maps directly to our EXP-100 findings:
- **Medium-complexity success** (0%→100% with scaffolding): Scaffolding provided explicit structure (#2) that was sufficient for structurally simple tasks
- **High-complexity failure** (50%→0% with forced checkpoints): Checkpoint overhead consumed structural reasoning capacity (#1), creating alignment tax (per DD-671)
- **Verification Theater (FM-3.3b)**: Agent performs LLM-level verification (#4) without structural competence (#1-2) — form without substance

### EXP-100 Redesign Implications
The three papers provide a complete redesign framework:

1. **From DD-676**: Shift evaluation from task-level difficulty to **mid-trajectory structural complexity** — inject complex JSON state, multi-step tool chains (6+ steps), intermediate outputs requiring structured parsing
2. **From DD-677**: Evaluate whether interventions increase **explicit structural mechanisms** (#1-3) vs. adding **LLM overhead** (#4). Successful interventions should feel mechanical, not cognitive.
3. **From DD-678**: Use HAAF scenario manifold to parameterize difficulty (file count × dependency depth × state complexity × tool chain length × ambiguity), then NAAMSE-style evolutionary search to find the CIVC boundary

### Concrete Scenario Design Parameters
Based on DD-676's 12 risk categories and our FM taxonomy:

| Dimension | Low (ceiling) | Medium (sweet spot) | High (CIVC trigger) |
|-----------|--------------|---------------------|---------------------|
| File count | 1-2 | 3-5 | 6+ |
| Cross-file dependencies | None | Linear chain | DAG/circular |
| State complexity (JSON depth) | Flat | 2-3 levels | 4+ nested with arrays |
| Tool chain length | 1-2 steps | 3-5 steps | 6+ steps |
| Ambiguity level | Explicit spec | Implicit constraints | Contradictory signals |

**Prediction**: CIVC boundary is a **sharp threshold** (not gradual) along the structural complexity dimension (P-678b). The boundary will be found most efficiently via evolutionary search (P-678a: 3-5× faster than manual design).

## Connection to DD-676 + DD-677 Joint Insight

The most important synthesis across these papers: **structural competence (not safety alignment or scale) is the key to verification quality.** This has three implications:

1. **For intervention design**: Build structural scaffolding (explicit state tracking, structured verification templates), NOT more LLM prompting
2. **For evaluation design**: Test structural parsing under complexity, NOT semantic alignment under adversarial pressure
3. **For system architecture**: The "declared reflective runtime protocol" (DD-677) — externalizing agent state into inspectable structure — is exactly what our checkpoint/context/intervention system does. The formal validation confirms this design pattern.

## Open Questions
1. Where exactly is the CIVC sharp threshold? (Need evolutionary scenario search per DD-678)
2. Can structural scaffolding (explicit JSON verification templates) eliminate FM-3.3b Verification Theater?
3. Does the non-monotonic LLM revision finding (DD-677) explain why our forced checkpoints harm high-complexity? (Checkpoints force more LLM revision turns → noise accumulates)
4. Is the ~4.3% optimal LLM intervention frequency generalizable to our system?

## Predictions
- P-089a: Scenarios requiring JSON/structured data verification will trigger CIVC at higher rates than natural language scenarios (from DD-676 P-676a)
- P-089b: Interventions that add explicit structural mechanisms (state tracking, verification templates) will outperform interventions that add LLM reasoning steps (more reflection, more checkpoints)
- P-089c: The CIVC boundary is a sharp threshold along structural complexity, discoverable 3-5× faster via evolutionary scenario search than manual design
- P-089d: Optimal LLM intervention frequency for our coder agent is 3-7% of turns — matching DD-677's empirical finding

---
*Session 389 | April 2026*
