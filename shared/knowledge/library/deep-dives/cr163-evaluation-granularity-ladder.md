# CR#163: The Evaluation Granularity Ladder — Why Coarse Metrics Systematically Deceive

**Cross-Reference Synthesis connecting DD#303 (LLM Judge Best-of-N Failure), DD#304 (CRYSTAL Step-Level Reasoning), DD#306 (VQQA Semantic Gradient Evaluation)**

**Date:** 2026-03-16
**Type:** Cross-Reference Synthesis
**Prior cross-references for these DDs:** DD#303 (0), DD#304 (0), DD#306 (0) — all orphans

---

## The Unifying Discovery

Three independent papers from the March 2026 batch converge on a single structural pattern: **evaluation quality scales with granularity, and every level of coarsening introduces a systematic bias that looks like signal but is actually noise.**

Each paper attacks a different evaluation domain (selection, reasoning, generation quality) but discovers the same mechanism: aggregate metrics capture between-instance variation (easy vs. hard) while failing at within-instance discrimination (which response/step/frame is actually better). The result is that evaluation systems that look good on dashboards are actually failing at their deployed task.

---

## The Three Perspectives

### DD#303: LLM Judge Selection (Landesberg, Mar 2026)
**Domain:** Text response quality selection (Best-of-N from Chatbot Arena)

**Granularity failure:** Global correlation r=0.47 masks within-prompt correlation r=0.27. The judge gets credit for recognizing that some prompts are hard — but fails at its actual job of picking the best response TO a specific prompt.

**Key metric:** Recovery rate — only 21% with pointwise scoring vs. 61.2% with pairwise comparison. The difference is entirely due to evaluation granularity: pairwise forces within-prompt comparison; pointwise allows escape to between-prompt signal.

**Fix:** Pairwise judging (3× recovery). Report within-prompt signal, tie rates, and top-1 accuracy.

### DD#304: CRYSTAL Reasoning Evaluation (Barrios & Jin, Mar 2026)
**Domain:** Multimodal reasoning process evaluation

**Granularity failure:** Answer accuracy (coarse) diverges from reasoning quality (fine). Models achieve correct final answers through cherry-picked reasoning — high precision but low recall on intermediate steps. 19/20 models have precision >> recall (ratios 1.2× to 7.2×). Even GPT-5 at 58% accuracy covers only 48% of reference reasoning steps.

**Key metric:** Match F1 vs. Ordered Match F1. Simply matching steps isn't enough — step ORDER matters. No competitive model maintains >60% of matched steps in correct order.

**Fix:** Step-level evaluation with multiplicative coupling (CPR: Causal Process Reward). GRPO training with CPR-Curriculum achieves +32% Match F1 where additive strategies fail.

### DD#306: VQQA Video Quality Evaluation (Song, Pfister, Song/Google, Mar 2026)
**Domain:** Video generation quality assessment

**Granularity failure:** Monolithic VLM evaluation catches 70.2% of problems. Decomposed QA evaluation catches 82.1% (+11.9%). The structured decomposition into Question Generation → Question Answering → Prompt Refinement catches flaws that direct assessment misses.

**Key metric:** Average-QA selection (per-dimension scores) vs. Global Selection (holistic). Average-QA UNDERPERFORMS Global Selection by 1.86% — granular scores provide good gradients for local refinement but fail to capture "gestalt alignment" for final selection.

**Paradox:** More granularity is better for diagnosis but WORSE for selection. This mirrors DD#303's finding at a structural level.

---

## The Evaluation Granularity Ladder

Combining all three papers reveals a hierarchy:

```
Level 5: STEP-LEVEL PROCESS (DD#304)
│  Evaluate each intermediate step for correctness + ordering
│  Catches: cherry-picking, hallucinated reasoning, order violations
│  Misses: Gestalt quality ("is the overall answer satisfying?")
│  
Level 4: PAIRWISE WITHIN-INSTANCE (DD#303)
│  Compare candidates head-to-head for same input
│  Catches: relative quality differences
│  Misses: Process failures (right answer, wrong reasoning)
│  
Level 3: DECOMPOSED MULTI-DIMENSION (DD#306)
│  Score across orthogonal quality axes
│  Catches: dimension-specific flaws, local improvement opportunities
│  Misses: Gestalt alignment (individual scores don't compose linearly)
│  
Level 2: POINTWISE WITHIN-INSTANCE
│  Score each candidate independently for same input
│  Catches: absolute quality threshold violations
│  Misses: 2/3 of comparisons are ties (DD#303: 67% tie rate)
│  
Level 1: GLOBAL AGGREGATE
│  Average scores across all inputs
│  Catches: Nothing useful for selection
│  Provides: Illusion of evaluation (r=0.47 globally, r=0.27 locally)
```

### The Systematic Bias at Each Level

| Level | What It Measures | What It Claims to Measure | Bias Direction |
|-------|-----------------|--------------------------|----------------|
| L1 Global | Between-prompt difficulty | Within-prompt quality | **Optimistic** — looks better than it is |
| L2 Pointwise | Threshold compliance | Relative quality | **Noisy** — 67% ties make selection random |
| L3 Decomposed | Dimension-specific quality | Overall quality | **Incomplete** — doesn't compose linearly |
| L4 Pairwise | Relative preference | Process quality | **Surface** — right answer masks wrong reasoning |
| L5 Step-level | Process correctness | Task completion | **Overly strict** — may reject valid alternative paths |

**The critical pattern:** Each level's bias is INVISIBLE when measured at its own granularity. You only see the failure by evaluating at the next finer level. This creates a **granularity trap**: organizations validate their evaluation at the coarsest level that looks good and stop there.

---

## Structural Relationships

### The Diagnosis-Selection Paradox

DD#306 reveals a tension that reconciles DD#303 and DD#304:

- **For diagnosis** (finding what's wrong): More granularity is always better. DD#306's decomposed QA catches +11.9% more issues. DD#304's step-level evaluation reveals cherry-picking invisible at the answer level.
- **For selection** (picking the best): Moderate granularity is optimal. DD#306's Global Selection beats Average-QA. DD#303's pairwise (not step-level) achieves best recovery.

**Resolution:** Evaluate at maximum granularity for feedback, but aggregate with holistic judgment for selection. The decomposition identifies what's wrong; the gestalt judgment decides which option is least wrong.

This maps to a dual-loop architecture:
```
Inner loop (DIAGNOSIS): Fine-grained → generate improvement signal
  DD#304: Step-level Match F1 → identify missing/wrong steps
  DD#306: Per-dimension QA scores → identify visual flaws
  DD#303: Within-prompt comparison → identify quality differential

Outer loop (SELECTION): Holistic → make final choice
  DD#304: CPR reward (multiplicative, not additive) → weighted decision
  DD#306: Global Selection → gestalt alignment check
  DD#303: Pairwise judgment → relative preference
```

### Connection to Symphony-Coord (DD#325)

Symphony-Coord's reward signal design mirrors this dual-loop pattern:
- **Inner:** Component rewards (success indicator, latency penalty, correctness term) = decomposed diagnosis
- **Outer:** Winner bonus (agrees with voted output) = holistic selection signal

The bandit mechanism naturally implements the right evaluation granularity: it uses multiple fine-grained context features for routing (diagnosis) but optimizes for a single composite reward (selection).

### Connection to Memory-Diversity (CR#162)

CR#162's "standard metrics are blind to diversity depletion" is a special case of this synthesis's core finding. Diversity metrics are evaluated at L1 (global aggregate) when they should be measured at L3+ (per-dimension diversity, per-capability diversity, per-memory-type diversity). The invisible Phase 2→3 transition IS the granularity trap applied to diversity measurement.

---

## Emergent Framework: Multi-Granularity Evaluation Architecture (MGEA)

Combining all three papers, a principled evaluation architecture emerges:

### Design Principles

1. **Evaluate at maximum affordable granularity** (DD#304: step-level when possible)
2. **Select at moderate granularity** (DD#303: pairwise, not pointwise; DD#306: global, not per-dimension)
3. **Always report within-instance metrics** (DD#303: within-prompt correlation mandatory)
4. **Multiplicative coupling over additive** (DD#304: CPR multiplies process × answer; additive lets either dominate)
5. **Decompose for feedback, compose for decisions** (DD#306: dual-loop)

### Implementation Template

```
evaluate(candidates, input):
    # DIAGNOSIS (maximum granularity)
    for each candidate:
        step_scores = evaluate_steps(candidate.reasoning)    # DD#304
        dim_scores = evaluate_dimensions(candidate.output)    # DD#306
    
    # SELECTION (moderate granularity)
    if len(candidates) == 2:
        return pairwise_judge(candidates, input)              # DD#303
    else:
        # Tournament pairwise with holistic global check
        winner = tournament_pairwise(candidates, input)       # DD#303
        global_check = holistic_evaluate(winner, input)       # DD#306
        return (winner, step_scores, dim_scores, global_check)
```

---

## Predictions

### Prediction 84: The Evaluation Granularity Gap
Any multi-agent system using L1 or L2 evaluation (global aggregates, pointwise scoring) for quality selection will achieve **at most 21% of theoretically possible improvement** (DD#303's recovery rate). Upgrading to L4 (pairwise) recovers 61%. Upgrading to L5 (step-level + pairwise) should recover 75-85%.

### Prediction 85: Multiplicative Coupling Is Universal
DD#304's finding that multiplicative coupling outperforms additive will replicate across all evaluation domains. The reason: additive coupling allows a high score in one dimension to compensate for failure in another, while multiplicative ensures that failure in ANY dimension limits the overall score. This matches human judgment better because humans use satisficing (reject below threshold on any dimension) rather than compensatory (average across dimensions).

### Prediction 86: Evaluation Granularity Arms Race
As models improve, the useful evaluation granularity level will shift upward. Currently L4 (pairwise) is adequate for most selection tasks. Within 12 months, model outputs will be similar enough that L4 will show the same tie-rate problem L2 currently has, and L5 (step-level process evaluation) will become mandatory.

---

## Application to Our System

### Current Evaluation Practices

| System Component | Current Level | Recommended Level | Gap |
|-----------------|--------------|-------------------|-----|
| Scout DD quality | L1 (star rating) | L3 (multi-dimension) | Score relevance, depth, novelty, actionability separately |
| Bob implementation review | L2 (QA pass/fail) | L4 (pairwise against alternatives) | Compare approaches head-to-head |
| Cross-reference quality | None | L4 (pairwise: this CR vs. prior CRs) | Which synthesis generated more actionable insight? |
| SIGNALS.md handoff evaluation | L2 (ACK/REJECT) | L3 (decomposed: accuracy, completeness, actionability) | What specifically was useful? |

### Priority Actions

1. **Implement within-instance evaluation for Scout DDs:** When comparing papers to research, don't just ask "is this good?" (L2) — ask "is this better than the alternative I could have researched?" (L4)

2. **Add step-level reasoning evaluation for Bob implementations:** Don't just check if code works (answer-level) — evaluate whether the implementation approach matches the architectural reasoning (process-level)

3. **Pairwise SIGNALS.md evaluation:** When handing off artifacts, include a comparison to the most recent similar artifact. "This CR is better/worse than CR#X at Y because Z."

4. **Multiplicative quality gates:** Instead of "passes test suite AND looks clean" (additive), use "passes test suite × code quality × architecture alignment" (multiplicative). A 0 in any dimension should kill the evaluation.

---

## Limitations

1. **Computational cost scales with granularity.** Step-level evaluation (L5) is ~10× more expensive than pointwise (L2). The papers don't analyze the cost-quality Pareto frontier.

2. **Reference generation.** DD#304's CRYSTAL requires reference reasoning steps. DD#306's VQQA requires reference quality standards. In open-ended generation, references may not exist or may be subjective.

3. **Granularity ceiling.** At some point, finer granularity introduces more noise than signal (evaluating individual tokens? individual reasoning substeps?). The optimal granularity level is domain-dependent and not characterized.

4. **Evaluator consistency.** DD#303's pairwise improvement assumes the evaluator is more consistent in pairwise mode. If the evaluator itself is noisy, pairwise may just shuffle noise differently. DD#304's Delphi-inspired reference generation partially addresses this with multi-evaluator consensus.

---

## Summary

Three orphan deep-dives, each at zero cross-references, reveal that evaluation quality scales predictably with measurement granularity, creating a five-level Evaluation Granularity Ladder. The core finding: **every evaluation level's systematic bias is invisible when measured at its own granularity** — you only see the failure by going one level finer. This creates a granularity trap where organizations validate evaluation at the coarsest level that looks good and stop there. The fix is a dual-loop architecture: maximum granularity for diagnosis, moderate granularity for selection, with multiplicative coupling to prevent compensatory scoring. The diagnosis-selection paradox (more granularity helps diagnosis but hurts selection) is resolved by separating the two functions and optimizing each independently.

---

*Connected DDs: #303, #304, #306 (3 orphan DDs → 0 remaining orphans)*
*Connected DDs (secondary): #325 (Symphony-Coord reward design), #301 (diversity collapse + evaluation)*
*Connected CRs: #162 (Memory-Diversity — granularity trap as special case)*
*New contributions: Evaluation Granularity Ladder (5 levels), Diagnosis-Selection Paradox, MGEA template*
*Predictions: 84 (Granularity Gap), 85 (Multiplicative Coupling Universal), 86 (Granularity Arms Race)*
