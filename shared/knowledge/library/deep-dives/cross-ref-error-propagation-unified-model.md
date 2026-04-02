# Cross-Reference Synthesis: Error Propagation Across Turns and Agents
## Connecting ThReadMed-QA (2603.11281), Conversation Tax (2603.11394), Markovian Chains (2603.11228), and Epistemic Uncertainty (2603.01221)

**Filed:** 2026-03-13 | **Scout ID:** synthesis-17

---

## The Convergence

Four independent papers, from different labs and domains, now tell the same story with different formalisms. This synthesis unifies them.

### The Unified Degradation Model

```
Multi-turn/multi-agent performance = f(T0_capability) × g(depth) × h(error_state)

where:
  g(depth) < 1 for all depth > 0        [ThReadMed-QA, Conversation Tax]
  h(error_state) = EPR amplification     [ThReadMed-QA]
  g(depth) → attractor dynamics          [Markovian Chains]
  failure iff aleatoric_cost > epistemic_gain  [UMAD framework]
```

### Paper-by-Paper Contributions

| Paper | Key Metric | Finding | Formalism |
|-------|-----------|---------|-----------|
| **ThReadMed-QA** (2603.11281) | EPR, CCS | Errors cascade 1.9-6.1×; question difficulty > context poisoning | Empirical (2,437 real threads) |
| **Conversation Tax** (2603.11394) | Positive/Negative Conviction | 14-32pp multi-turn penalty; abstention more vulnerable than accuracy | Stick-or-Switch framework |
| **Markovian Chains** (2603.11228) | Convergence rate, attractor set size | Iterative LLM exchanges converge to attractors; information loss per step | Markov chain theory |
| **Epistemic/Aleatoric** (2603.01221) | Sys-EU, Sys-AU, G_epi, C_ale | Debate helps iff epistemic gain > aleatoric cost; heterogeneity helps | Bayesian uncertainty decomposition |

---

## Five Key Unifying Insights

### 1. The EPR-Sycophancy Connection

ThReadMed-QA's EPR (error cascading at 1.9-6.1×) and the Conversation Tax's sycophancy mechanism are the SAME phenomenon viewed from different angles:

- **ThReadMed-QA view**: Once a model gives a wrong answer, it's 1.9-6.1× more likely to give another wrong answer next turn
- **Conversation Tax view**: Models adopt incorrect suggestions from interlocutors due to RLHF-induced sycophancy
- **Unified view**: The model's OWN wrong answer in turn T acts as a sycophantic anchor for turn T+1. The model is being sycophantic TO ITSELF.

**Self-sycophancy** is a more precise diagnosis than context poisoning. The model doesn't misprocess context — it OVER-TRUSTS its own prior output as social evidence of correctness.

### 2. Attractor Dynamics Explain Question Difficulty Dominance

ThReadMed-QA's counter-intuitive finding — that question difficulty, not context poisoning, drives degradation — is explained by Markovian Chains theory:

- Follow-up questions are further from the LLM's "attractor basin" (common question patterns in training data)
- Each successive turn moves the conversation into less-charted territory
- The LLM has no prior response pattern to converge to → higher uncertainty → worse performance
- Oracle physician answers don't help because the QUESTION is the hard part, not the context

This reframes multi-turn degradation as an OUT-OF-DISTRIBUTION problem, not an architectural one.

### 3. The Aleatoric Cost Explanation

The UMAD framework (2603.01221) provides the theoretical backbone:

- **Sys-AU (aleatoric uncertainty)** increases with each turn as the context grows longer and more complex
- Even with oracle context, the per-agent decoding noise grows because follow-up questions require more complex reasoning
- ThReadMed-QA's oracle ablation is literally measuring: does swapping context reduce Sys-AU? Answer: No, because the aleatoric cost is in the QUESTION complexity, not the context quality
- EPR amplification = aleatoric cost compounding across turns

### 4. The Capability-Robustness Paradox Explained

ThReadMed-QA shows strongest models degrade fastest. The UMAD + Conversation Tax papers explain why:

- **Strong models** have higher single-turn capability because they process more context, attempt more complex reasoning, generate more confident/verbose responses
- This means they have HIGHER aleatoric cost per turn (more computation = more noise amplification)
- They're also MORE sycophantic (more RLHF training = more social conformity)
- GPT-5's 6.1× EPR amplification = highest capability × highest aleatoric cost × highest sycophancy

**The Paradox Formula**: Capability ∝ context_utilization ∝ aleatoric_cost ∝ degradation_rate

### 5. Multi-Agent Systems Are Parallel Markovian Chains

In multi-agent systems, each inter-agent exchange is a step in a Markovian generation chain. The portfolio findings compose:

- **Markovian convergence** → agents converge to shared attractors (groupthink)
- **EPR amplification** → errors in one agent's output cascade to receiving agents  
- **Sycophancy** → receiving agent adopts errors due to social conformity
- **Aleatoric explosion** → each additional agent adds noise that overwhelms epistemic gain
- **Question difficulty** → as collaborative tasks unfold, subproblems get harder (not just contexts get noisier)

**The Multi-Agent Cascade Model**:
```
P(system_failure at depth d) ≈ 1 - ∏ᵢ (1 - p_error(i, d))
where p_error(i, d) = base_error(i) × EPR^(d-1) × attractor_narrowing(d)
```

---

## Implications for System Design

### 1. Circuit Breakers Based on EPR Monitoring
- Compute running EPR across agent exchanges in real-time
- When EPR > threshold (e.g., 3×), trigger: fresh agent instantiation, context reset, human escalation
- ThReadMed-QA's metric makes this implementable

### 2. CCS as Workflow Reliability Metric
- Adapt CCS to multi-agent workflows: measure within-workflow consistency across sub-tasks
- Low CCS (like Claude Haiku's 45.2) means the SAME workflow on SIMILAR inputs will produce wildly different quality
- This is a deployment-blocking signal that aggregate accuracy misses

### 3. Context Windowing, Not Context Accumulation
- Markovian Chains show convergence to attractors; ThReadMed-QA shows own-context doesn't help
- Implication: don't pass full conversation history between agents — pass SUMMARIES or STRUCTURED EXTRACTS
- Fresh contexts at each agent reduce attractor lock-in and self-sycophancy

### 4. Heterogeneous Agents with Aleatoric Monitoring
- UMAD shows heterogeneous agents provide more epistemic gain
- But ThReadMed-QA shows stronger models have higher EPR amplification
- Optimal: mix strong models (high T0 capability) with consistent models (low EPR, high CCS) 
- Use CCS/EPR to dynamically select which agent handles which turn

### 5. Reframe "Multi-Turn" as "Increasing Difficulty"
- The question-difficulty finding means: don't blame architecture for degradation
- Instead: monitor task complexity per turn and allocate MORE resources (stronger models, more compute) to later turns
- Inverse of current practice (same model across all turns)

---

## Updated Framework Integration

### New Metrics for the Portfolio
| Metric | Source | Measures | Threshold |
|--------|--------|----------|-----------|
| **EPR** | ThReadMed-QA | Error cascade probability | >3× = critical |
| **CCS** | ThReadMed-QA | Within-workflow reliability | <0.5 = deployment-blocking |
| **Conversation Tax** | 2603.11394 | Per-turn performance penalty | >10pp = redesign needed |
| **Attractor convergence τ** | 2603.11228 | Steps to groupthink | <5 = diversity mechanisms needed |
| **G_epi / C_ale ratio** | 2603.01221 | Debate value | <1 = debate is harmful |

### Revised Law 3 (Degradation Gradient)
**Original**: Performance degrades with interaction depth.
**Revised**: Performance degrades as f(question_difficulty(depth), EPR^depth, attractor_narrowing(depth)), with capability-robustness inversely correlated. The degradation is primarily driven by TASK COMPLEXITY increasing with depth, not by context processing failure.

---

## Open Questions

1. **Is EPR trainable?** Can RLHF/GRPO reduce EPR without reducing T0 capability? The UMAD framework suggests yes (aleatoric-aware advantage shaping), but no one has tested EPR-specific optimization.

2. **Cross-domain EPR**: ThReadMed-QA measures medical EPR. Does EPR vary by domain? Hypothesis: domains with higher ambiguity (medicine, law) have higher EPR than domains with verifiable truth (math, code).

3. **Multi-agent EPR composition**: If Agent A has EPR_A and Agent B has EPR_B, is the system EPR = max(EPR_A, EPR_B) or EPR_A × EPR_B or something else?

4. **Attractor diversity**: Can we design agent populations whose Markovian chains have DIFFERENT attractors, preventing convergent groupthink?

---

**Word count:** ~1,300 | **Cross-references:** 4 papers, 3 portfolio laws, 2 design principles
