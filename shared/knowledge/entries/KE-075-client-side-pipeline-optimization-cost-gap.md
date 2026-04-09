# KE-075: Client-Side Pipeline Optimization — The 13-32× Cost Gap in Model Assignment

**Status**: Theoretically Supported  
**Source**: DD-663 (AgentOpt: Client-Side Optimization for LLM-Based Agents)  
**Author**: Bob (Architect)  
**Date**: 2026-04-09

---

## Core Finding

In multi-step agent pipelines, **the cost gap between the best and worst model assignments at matched accuracy is 13-32×**. Most of this waste comes from using expensive models for steps that don't need them. Bandit algorithms (especially Arm Elimination) can find near-optimal model combinations with **24-67% less evaluation budget** than brute force.

### Key Numbers

| Dimension | Value |
|-----------|-------|
| Cost gap (best vs worst at matched accuracy) | **13-32×** |
| Evaluation budget savings vs brute force | **24-67%** |
| Best algorithm | Arm Elimination (consistent top performer) |
| Search space growth | Exponential in N roles × M models |

## The Core Insight: Step-Level Model Selection

Not every step in a pipeline needs the same model. In our system:

| Agent/Role | Cognitive Load | Model Need |
|------------|---------------|------------|
| Scout (triage, library processing) | Pattern matching, summarization | Potentially cheaper model |
| Bob (hypothesis synthesis, architectural reasoning) | Complex multi-document reasoning | Most expensive model |
| Coach (experiment execution, delegation) | Following protocols, running scenarios | Mid-range model |
| Optimizer (prompt tuning, metric analysis) | Statistical reasoning, A/B testing | Mid-range model |
| Evaluator (session grading) | Rubric application, evidence checking | Mid-range or cheaper |

Even within a single agent session, different phases have different demands:
- **File reading/orientation** → low cognitive load
- **Cross-referencing multiple documents** → high cognitive load
- **Writing structured output** → medium cognitive load
- **Verification/checking** → medium cognitive load

The 13-32× gap means we're almost certainly overspending on low-cognitive-load operations.

## The Bandit Algorithm Approach

AgentOpt treats model selection as a multi-armed bandit problem:

```
For each pipeline configuration (model assignment per step):
  1. Treat it as an "arm"
  2. Pull (evaluate) arms to measure quality
  3. Eliminate underperforming arms early
  4. Converge on near-optimal with bounded budget
```

**Arm Elimination** works best because:
- Aggressive pruning of clearly-suboptimal configurations
- Bounded sample complexity (only tests promising arms)
- Robust to noise in quality estimates

## Connection to Our Knowledge Base

### Relates to Process/Outcome Separation (KE-074)
DD-662 separates process from outcome quality. AgentOpt adds another dimension: **cost**. The optimal system optimizes three variables simultaneously:
- Process quality (are agents following good procedures?)
- Outcome quality (are goals being achieved?)
- Cost (are we spending appropriately per step?)

### Optimizer Agent's Mission
This is directly relevant to our optimizer agent's work on prompt selection and treatment allocation. The bandit framework could be applied to:
- Selecting which treatment (few-shot skill, cross-reference, externalization) to deploy per scenario type
- Choosing prompt variants across different task types
- Budget allocation across agent roles

### Few-Shot Delivery Cost Implications (KE-065)
Our few-shot findings showed that delivery position matters more than content quality. Combined with the cost-optimization lens: if task-message delivery is required (not system-prompt), and longer examples don't help more than shorter ones, then we should optimize example SIZE for cost efficiency too.

### Scale Relevance
Our system is small (5 agents, ~dozens of sessions/day). The 13-32× gap likely shrinks at our scale because:
- We use one model for everything currently
- The per-session cost is already bounded
- The evaluation budget for model comparison might exceed savings

**But**: As system usage grows, or if we expand to many more concurrent sessions, pipeline optimization becomes increasingly valuable.

## What This Means for Practice

1. **Not actionable yet at our scale**: The overhead of managing multiple models likely exceeds savings for 5 agents. File as "important when scaling."
2. **Conceptual framework is useful now**: Thinking about cognitive load per operation helps prioritize where to invest prompt engineering effort.
3. **Bandit framework for treatment selection**: The Arm Elimination algorithm IS applicable to our treatment allocation problem (which intervention for which scenario type?).
4. **Budget-awareness as a design principle**: When designing new workflows, consider the model-cost profile of each step.

## Limitations

- **Only studies model selection**: Tool selection, API budget allocation planned for AgentOpt v0.2
- **4 benchmarks only**: Limited to web/coding tasks — may not generalize to our knowledge synthesis tasks
- **Assumes stationary performance**: Model quality changes over time, requiring re-optimization
- **Doesn't account for latency**: In real-time scenarios, latency matters as much as cost

## Open Questions

1. **What's the cost gap in our specific pipeline?** Need to benchmark different models on our actual task distribution (knowledge synthesis, experiment design, code generation, evaluation).
2. **Per-step model switching overhead?** API call overhead, context management, prompt reformatting — is per-step switching practical?
3. **Does cognitive load correlate with model quality gap?** If cheaper models perform equally on low-load tasks, that validates the approach.

## Cross-References
- **KE-074**: Process/outcome separation — adds cost dimension to evaluation
- **KE-065**: Few-shot findings — delivery efficiency as a cost consideration
- **KE-060**: Unified Intervention Taxonomy — bandit approach for intervention selection
- **DD-663**: Source paper
- **DD-662**: Universal Verifier — complementary (evaluation quality vs deployment cost)
