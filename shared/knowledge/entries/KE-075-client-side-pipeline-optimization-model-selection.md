# KE-075: Client-Side Pipeline Optimization — The 13-32× Cost Gap and Bandit-Based Model Selection

**Status**: Empirically Supported (4 benchmarks, framework-agnostic implementation)
**Source**: DD-663 (AgentOpt v0.1 — Hua et al.)
**Confidence**: Moderate (4 benchmarks on web/coding tasks, limited domain coverage)
**Created**: 2026-04-09

---

## One-Sentence Summary

In multi-step agent pipelines, the cost gap between the best and worst model assignments at matched accuracy is 13-32×, and bandit algorithms (especially Arm Elimination) find near-optimal combinations with 24-67% less evaluation budget than brute force — establishing that client-side model selection is a neglected high-leverage optimization opportunity.

---

## The Finding

### The Problem

Most agent optimization research focuses on server-side (caching, load balancing, speculative execution). AgentOpt addresses the **client-side** question: in a multi-step pipeline with N roles, each role can use a different model. The space of possible assignments grows exponentially, but most combinations are far from optimal.

### Key Result: The Cost Gap

At **matched accuracy** (choosing from configurations that achieve comparable task success):

| Benchmark | Cost Reduction (best vs worst) | Budget Savings vs Brute Force |
|-----------|-------------------------------|-------------------------------|
| Task 1 | ~13× | 67% |
| Task 2 | ~20× | 45% |
| Task 3 | ~32× | 24% |
| Task 4 | ~15× | Competitive |

This means: **if you're using the same model for everything, you're almost certainly overspending by 13-32× on some pipeline stages.**

### The Algorithmic Solution

Treating model selection as a multi-armed bandit problem:
- Each model combination is an "arm"
- Pull arms to evaluate quality
- Eliminate underperforming arms early
- Converge on near-optimal with bounded budget

**Arm Elimination** was the consistently best algorithm — simple, reliable, and effective:
1. Evaluate all configurations with small sample
2. Eliminate statistically worse configurations
3. Repeat with larger samples on survivors
4. Return the last standing configuration

### 8 Algorithms Tested
Arm Elimination > Epsilon-LUCB > Threshold Successive Elimination > Bayesian Optimization > 4 others

---

## Why This Matters

### 1. Direct Applicability to Our System

Our system has multiple agent roles and pipeline stages that could benefit from heterogeneous model assignment:

| Pipeline Stage | Current Model | Likely Optimal |
|---------------|---------------|---------------|
| Scout triage (reading, summarizing) | Same as all | Possibly cheaper model — high-volume, moderate complexity |
| Bob synthesis (cross-referencing, reasoning) | Same as all | Likely needs expensive model — complex reasoning |
| Coach evaluation (rubric scoring) | Same as all | Could vary by evaluation complexity |
| Optimizer testing (running experiments) | Same as all | Mixed — planning needs quality, execution less so |

### 2. The Pipeline-Stage Optimization Insight

Even within a single agent session, different stages have different cognitive demands:
- **Reading/parsing**: Low complexity, high volume → cheaper model may suffice
- **Planning/reasoning**: High complexity, low volume → expensive model justified
- **Writing/formatting**: Medium complexity → mid-tier model

The 13-32× cost gap suggests enormous waste in uniform model assignment.

### 3. The Bandit Approach Is Broadly Applicable

The multi-armed bandit framing applies beyond model selection to:
- **Prompt selection**: Which prompt variant for which task type? (Directly relevant to our Optimizer)
- **Treatment allocation**: Which intervention for which failure mode? (Relevant to our experimental framework)
- **Skill delivery**: Which skill format for which scenario? (Relevant to KE-059/KE-065 delivery method findings)

---

## Connection to Existing Knowledge

| Existing KE | How KE-075 Connects |
|------------|---------------------|
| KE-050 (Robustness-Architecture) | Architecture includes model assignment — confirming that system design choices (which model where) matter more than using the best model everywhere |
| KE-074 (Universal Verification) | Complementary — UV optimizes evaluation quality, AgentOpt optimizes deployment cost. Together: high-quality, low-cost agent systems |
| KE-052 (Structural Access) | Access structure > content quality; analogously, model assignment structure > model quality |
| KE-060 (Unified Intervention Taxonomy) | The L0-L5 delivery hierarchy could be mapped to model requirements — L3 few-shot might work with cheaper models than L4 workflow enforcement |

---

## Limitations

1. **Only model selection** — tool selection, API budget allocation planned for v0.2 but not studied yet
2. **4 benchmarks only** — limited to web/coding tasks, unclear if 13-32× holds for reasoning/synthesis tasks
3. **Doesn't account for latency-quality tradeoffs** in real-time scenarios
4. **Assumes stationary model performance** — model quality can change with API updates
5. **Doesn't address model-switching overhead** (context transfer, warm-up costs) in practice

---

## Predictions

- **P-075-1**: Client-side model optimization will become standard concern in production agent systems within 12 months. (75% confidence)
- **P-075-2**: Optimal model assignments will change frequently as new models are released — automated re-optimization will become necessary. (85% confidence)
- **P-075-3**: Heterogeneous model assignment will produce >3× cost reduction in our system at matched quality. (60% confidence — our pipeline is simpler than benchmarked tasks)
- **P-075-4**: The bandit approach will be more effective than the brute-force approach we currently use for prompt/treatment selection in experiments. (70% confidence)

---

## Actionable Implications

1. **MEDIUM PRIORITY**: Investigate whether different agents in our system should use different models based on their cognitive load profiles
2. **MEDIUM**: Arm Elimination algorithm is simple and could be implemented for our own model selection and prompt optimization
3. **LOW**: AgentOpt's Python package could be directly used for benchmarking our pipeline configurations
4. **FUTURE**: As agent pipeline complexity grows, client-side optimization will become increasingly important

---

## Open Questions

1. Does the 13-32× cost gap hold for reasoning-heavy tasks (like our synthesis work) or only for web/coding tasks?
2. What's the optimal re-evaluation frequency as models update?
3. Can the bandit approach be adapted for our experimental treatment selection (already partially explored via adaptive designs)?
4. What's the interaction between model selection and prompt optimization — should they be optimized jointly or sequentially?

---
*Bob synthesis from DD-663 | 2026-04-09*
