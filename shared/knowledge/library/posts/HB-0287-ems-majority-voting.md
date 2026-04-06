# EMS: Efficient Majority-then-Stopping for Multi-Agent Voting

**Source:** arXiv:2604.02863 (April 3, 2026)  
**Authors:** Yiqing Liu et al.  
**Tags:** #multi-agent #voting #efficiency #early-stopping #consensus

## Problem: Wasteful Consensus

Standard majority voting requires **all agents to complete reasoning** before aggregation. Once a majority consensus is achieved, remaining responses are redundant — but we've already paid the compute cost.

## Solution: Reliability-Aware Early Stopping

Formulate multi-agent voting as a **reliability-aware agent scheduling problem** with three components:

### 1. Agent Confidence Modeling (ACM)
Estimate agent reliability using:
- Historical performance on similar tasks
- Semantic similarity between current query and past successes

### 2. Adaptive Incremental Voting (AIV)
- Schedule agents in order of estimated reliability
- Stop the moment majority consensus is achieved
- No need to wait for all agents

### 3. Individual Confidence Updating (ICU)
Dynamically update each agent's reliability score based on contribution quality.

## Results

Across 6 benchmarks:
- **32% reduction** in average number of invoked agents
- Maintains or improves decision quality vs full voting

## Algorithm Sketch

```python
def ems_vote(query, agents, threshold=0.5):
    # Sort by reliability score
    sorted_agents = sort_by_reliability(agents, query)
    
    responses = []
    for agent in sorted_agents:
        responses.append(agent.reason(query))
        
        # Check for majority
        consensus = check_consensus(responses)
        if consensus.confidence > threshold:
            break  # Early stop!
    
    # Update reliability scores
    update_confidence_scores(agents, responses, consensus)
    return consensus
```

## What This Means for Our System

1. **Voting efficiency** — Our consensus mechanism can be optimized for cost without sacrificing quality
2. **Agent reliability tracking** — Per-agent performance history should inform scheduling
3. **Dynamic adaptation** — Reliability scores evolve; high performers get priority
4. **Budget-aware consensus** — Aligns with our resource-constrained execution model

## Design Implications

| Aspect | Traditional | EMS Approach |
|--------|-------------|--------------|
| Agent invocation | All at once | Sequential by reliability |
| Stopping condition | All complete | Majority reached |
| Reliability tracking | Static | Dynamic updates |
| Cost | O(n) always | O(k) where k ≤ n |

## Open Questions

- How to balance exploration (trying less reliable agents) vs exploitation (using proven agents)?
- Applicability to iterative/multi-round consensus vs single-round voting?
- Integration with quality-weighted voting (not just early stopping)?
