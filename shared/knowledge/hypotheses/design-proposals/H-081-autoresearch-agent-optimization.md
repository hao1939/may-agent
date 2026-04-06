# H-081: Autoresearch Pipeline for Agent Architecture Optimization

**Status:** ACTIVE  
**Created:** 2026-04-05  
**Source:** Omni-SimpleMem paper (arXiv:2604.01007) — [HB-0056](../library/posts/HB-0056-omnisimplemem-autoresearch-memory.md)

## Hypothesis

We can deploy an autonomous research pipeline to discover optimizations for our multi-agent system architecture, skills, and routing logic. Like Omni-SimpleMem demonstrated for memory systems, the highest-impact improvements will come from bug fixes, architectural changes, and prompt engineering — not hyperparameter tuning.

## Key Evidence from Omni-SimpleMem

| Discovery Type | Performance Contribution |
|---------------|------------------------|
| Bug fixes | +175% |
| Prompt engineering | +188% |
| Architectural changes | +44% |
| Hyperparameter tuning | Less than each above |

**Critical insight:** Traditional AutoML focuses on hyperparameters, but real gains come from fixing actual bugs, restructuring architecture, and optimizing prompts.

## What This Means for Our System

### 1. Applicable Domains
Our system has multiple components that could benefit from autoresearch:
- **Agent routing logic** — which agent handles which task type
- **Skill prompt optimization** — skill definitions and tool descriptions
- **Memory retrieval strategies** — when to recall what context
- **Multi-agent coordination protocols** — how agents delegate and collaborate
- **Tool/harness configurations** — timeout, retry, parallelization settings

### 2. Pipeline Design (Hypothetical)

```
Baseline Performance Measurement
        ↓
Failure Mode Analysis (which tasks fail? why?)
        ↓
Hypothesis Generation (arch change? bug fix? prompt?)
        ↓
Experiment Execution (A/B test on task subset)
        ↓
Result Validation (statistically significant?)
        ↓
Integration (merge if improved)
```

### 3. Expected High-Impact Areas
Based on Omni-SimpleMem's taxonomy:

| Our Component | Likely Discovery Type | Expected Impact |
|--------------|----------------------|-----------------|
| Skill definitions | Prompt engineering | High |
| Agent routing bugs | Bug fixes | Very High |
| Memory retrieval | Architectural changes | Medium-High |
| Coordination protocol | Architectural changes | Medium |

## Testable Predictions

1. **Bug fix dominance:** Fixing actual bugs in our agent routing/skill system will improve performance more than tuning temperature/max_tokens.

2. **Prompt sensitivity:** Optimizing skill prompts (descriptions, examples) will yield >50% improvement on skill execution accuracy.

3. **Architecture > hyperparameters:** Changing how we route tasks between agents will outperform tuning existing routing thresholds.

4. **Self-diagnosis feasibility:** We can build automated failure mode detection for our agent system without human labeling.

## Implementation Sketch

### Phase 1: Failure Mode Detection
- Track task success/failure by agent, skill, task type
- Cluster failures by error pattern
- Identify systematic vs random failures

### Phase 2: Hypothesis Generation
- For systematic failures: propose architectural changes
- For skill errors: propose prompt variations
- For routing errors: propose logic fixes

### Phase 3: Automated Experimentation
- Run A/B tests on task subsets
- Measure end-to-end success rate
- Statistical validation before integration

## Risks and Mitigations

| Risk | Mitigation |
|------|------------|
| Experiments break production | Isolate to staging/sandbox environment |
| Overfitting to test tasks | Holdout validation set, cross-task validation |
| Prompt optimization instability | Version control all prompts, rollback capability |
| Architecture changes cascade | Modular design, change one component at a time |

## Related Work

- Omni-SimpleMem: Memory system autoresearch (+411% F1)
- AutoAgent: Meta-agent framework optimizing task-agents (SpreadsheetBench 96.5%)
- OrgAgent: Discovered hierarchical > flat MAS (+102.73%)

## Next Steps

1. **Audit current system:** What are our known failure modes? Do we track them?
2. **Baseline measurement:** What's our current end-to-end task success rate?
3. **Pilot domain:** Pick one component (skill prompts? routing?) for autoresearch pilot
4. **Infrastructure:** Build experiment tracking and A/B testing framework

## Updates

| Date | Update |
|------|--------|
| 2026-04-05 | Created from Omni-SimpleMem findings |
