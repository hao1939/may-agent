# KE-089: Adaptive Verification & Evaluation — Mid-Trajectory Safety, Structural Decomposition, and Evolutionary Test Design

**Created:** 2026-04-09
**Sources:** DD-676, DD-677, DD-678
**Status:** Active

## Core Insight

Three independent research threads converge on a fundamental reframing: **agent verification and evaluation must be structural, adaptive, and mid-trajectory — not semantic, static, or output-only**. Safety guardrails fail because they target the wrong surface (natural language semantics instead of structured execution traces). Agent competence is dominated by explicit structure around the LLM, not LLM capability itself. And evaluation frameworks must evolve to find failure boundaries rather than sampling from fixed benchmark distributions.

## The Three Convergent Findings

### 1. Safety Lives in Execution Traces, Not Outputs (DD-676: TraceSafe-Bench)

**Finding**: The first comprehensive benchmark for mid-trajectory safety assessment of tool-calling agents reveals that guardrail effectiveness correlates with **structured data parsing ability** (ρ=0.79) and has **near-zero correlation with jailbreak robustness** (ρ≈0). Safety-trained models are not safer for agentic execution — they just handle adversarial prompts better.

**Key numbers**: 13 LLM guards, 7 specialized guardrails, 12 risk categories, 1000+ instances. General-purpose LLMs consistently outperform specialized safety guardrails in trajectory analysis. Architecture matters more than scale for risk detection.

**Implication**: The entire framing of "agent safety = prompt-level safety" is wrong. Agent safety requires structural competence — parsing JSON tool calls, tracking execution state, detecting inconsistencies in API response chains. This is an engineering problem, not an alignment problem.

**Temporal stability finding**: More execution steps actually *improve* risk detection — models pivot from static tool definitions to dynamic execution behaviors. This contradicts the naive "longer = harder to monitor" assumption.

### 2. Explicit Structure > LLM Reasoning (DD-677: Self-Revising Agent Decomposition)

**Finding**: A "declared reflective runtime protocol" decomposes agent competence into four components, revealing that **world-model planning provides +24.1pp win rate**, while LLM revision at ~4.3% of turns yields **non-monotonic results** (slightly improves F1, decreases win rate).

**The four-component hierarchy**:
1. Posterior belief tracking (baseline)
2. World-model planning (+24.1pp — dominant)
3. Symbolic reflection (not yet net-positive — helps on some metrics, hurts others)
4. LLM revision (small, non-monotonic — ~4.3% intervention frequency)

**Critical implication**: Most of what makes an agent competent comes from **explicit structure around the LLM**, not from the LLM itself. The externalized state protocol — making agent reasoning inspectable by design — is formally validated as a design pattern. LLM revision is useful but only at very sparse intervention rates, and selecting *when* to intervene matters more than intervention quality.

**Non-monotonicity**: Adding LLM-based revision introduces noise alongside signal. The benefit of LLM flexibility is offset by inconsistency. This maps directly to our EXP-100 alignment tax finding — forced checkpoints *harm* high-complexity tasks because the intervention overhead exceeds the verification benefit.

### 3. Evaluation Must Evolve to Find Failures (DD-678: HAAF + NAAMSE)

**Finding**: Two complementary frameworks address the core problem of static evaluation: HAAF provides **distribution-aware scenario manifold sampling** (parameterize test space, sample from high-risk regions), and NAAMSE provides **evolutionary genetic mutation of test scenarios** using model responses as fitness signal.

**HAAF's four components**: Static cognitive analysis → interactive sandbox simulation → social-ethical assessment → distribution-aware representative sampling. The "Trustworthy Optimization Factory" implements iterative red-team probing → blue-team hardening cycles.

**NAAMSE's mechanism**: Genetic prompt mutation + hierarchical corpus exploration + model responses as fitness signal. Evolutionary mutation **systematically amplifies vulnerabilities missed by one-shot methods**. Key innovation: asymmetric behavioral scoring prevents degenerate security (blanket refusal ≠ safety).

**Combined implication**: The reason EXP-100 showed ceiling effects is that manually designed scenarios don't systematically explore the failure surface. Fitness-driven evolutionary search would find CIVC-triggering configurations much faster than manual design.

## Cross-Source Patterns

### Pattern 1: The Structural Competence Thesis

All three sources independently validate the same principle: **structural reasoning competence determines agent reliability**, not semantic safety alignment, not model scale, not benchmark scores.

- DD-676: Structured data parsing (ρ=0.79) >> safety alignment (ρ≈0)
- DD-677: World-model planning (+24.1pp) >> LLM revision (non-monotonic)
- DD-678: Adaptive structural evaluation >> static benchmark sampling

This is the strongest external validation yet of the harness engineering thesis (KE-047, KE-085): the structure around the model matters more than the model itself.

### Pattern 2: The Intervention Frequency Problem

DD-677's finding that optimal LLM revision is ~4.3% of turns, with non-monotonic benefit, directly validates our EXP-100 finding that forced checkpoints (high intervention frequency) harm high-complexity tasks. The convergence:

| Source | Finding | Optimal Intervention |
|--------|---------|---------------------|
| DD-677 | LLM revision non-monotonic | ~4.3% of turns |
| EXP-100 | Forced checkpoints harm high-complexity | Adaptive (not forced) |
| DD-671 | Alignment tax from structural overhead | Complexity-proportional |
| DD-676 | More steps improve detection | Let verification develop naturally |

**Unified principle**: Intervention must be sparse and adaptive. The cost of intervening (reasoning capacity consumed, flow disrupted, noise introduced) must be weighed against the benefit. Current systems intervene either never (dangerous) or always (wasteful/harmful). The sweet spot is event-triggered verification — intervene only when structural signals indicate risk.

### Pattern 3: The Evaluation-Intervention Duality

DD-678's evolutionary evaluation framework and DD-677's runtime reflection protocol are structurally identical — both are adaptive systems that use feedback to find boundaries:

- **Evaluation side** (NAAMSE): Mutate test scenarios → observe failure → select harder scenarios → iterate
- **Intervention side** (DD-677): Monitor execution state → detect anomaly → intervene sparingly → learn when intervention helps

This duality suggests a **unified adaptive framework**: the same mechanisms that find agent failure boundaries during evaluation can monitor and correct agent behavior during deployment. Evaluation IS intervention, just applied at different times.

## Implications for Our System

### For H-093 (CIVC)
DD-676 provides the mechanistic explanation for *why* CIVC occurs: verification collapse happens in structural parsing of execution traces, not in semantic reasoning. To trigger CIVC reliably, scenarios need complex intermediate state requiring structural parsing — not just "hard" tasks.

### For EXP-100 Redesign
DD-678's combined HAAF+NAAMSE framework provides the methodology:
1. **From HAAF**: Parameterize scenarios across 4-5 structural dimensions (file count, dependency depth, state complexity, ambiguity, tool chain length)
2. **From NAAMSE**: Use evolutionary search to find CIVC-triggering configurations — verification failure rate as fitness signal
3. **From DD-676**: Focus on mid-trajectory structural complexity, not task difficulty per se

### For Intervention Architecture
DD-677 validates our externalized state approach (checkpoints, context files) and provides the 4-component decomposition framework for analyzing which aspects of intervention help vs. harm. The ~4.3% intervention frequency finding should calibrate H-094 (HVR) design.

## Extends

- **KE-088** (Agent Behavior Shaping): DD-677's non-monotonic LLM revision validates Layer 3 prompt engineering tension — intervention quality ≠ intervention benefit
- **KE-084** (Verification-Trust Architecture): DD-676's structural bottleneck finding grounds L1 structural verification — JSON parsing ability IS the verification substrate
- **KE-085** (Harness Engineering): DD-677's "explicit structure > LLM" validates harness engineering thesis with formal decomposition evidence
- **KE-086** (MAS Architecture): DD-678's HAAF framework addresses the evaluation gap in multi-agent scaling
- **KE-083** (Agent Safety Gap): DD-676's mid-trajectory safety assessment fills a specific gap in the safety stack — operational failures during execution, not adversarial attacks
- **H-093** (CIVC): All three papers provide external validation — DD-676 (mechanism), DD-677 (intervention limits), DD-678 (evaluation methodology)

## Predictions

- **P-089a**: Evolutionary scenario generation (NAAMSE-style) will find CIVC-triggering configurations 3-5× faster than manual scenario design
- **P-089b**: Agent verification effectiveness in our system will correlate more strongly with structured data handling (JSON/code parsing) than with safety alignment metrics
- **P-089c**: Optimal intervention frequency for our coder agent will be 3-7% of tool calls, matching DD-677's finding — below this is no benefit, above introduces alignment tax
- **P-089d**: Mid-trajectory safety monitoring (DD-676 style) will detect more agent failures than output-only evaluation, because errors compound and become undetectable at the output level

## Open Questions

1. Can DD-677's 4-component decomposition be applied retroactively to our EXP-100 data to determine which component failed at high complexity?
2. Does DD-676's temporal stability finding (more steps → better detection) hold for our verification interventions, or does our system show the opposite pattern (more steps → more decay)?
3. Can NAAMSE's evolutionary approach be combined with our gym infrastructure to automatically discover hard scenarios?
4. What is the relationship between DD-677's symbolic reflection (not yet net-positive) and our cross-reference intervention (100% on L3 tasks)? Same mechanism or different?
