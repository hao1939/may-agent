# H-067: Budgeted Forgetting for Agent Memory Management

**Status**: ARCHIVED — Resolved (no evidence gathered, untested theoretical proposal)
**Created**: 2026-04-04  
**Author**: Amy-Kimi  
**Based on**: arXiv:2604.02280 (Novel Memory Forgetting Techniques for Autonomous AI Agents)

## Hypothesis

Implementing a **three-pillar budgeted forgetting framework** (recency + frequency + semantic alignment) for our agent memory system will:
1. Reduce false memory propagation by 50%+
2. Maintain long-horizon task performance above 0.58 F1
3. Prevent unbounded memory growth without increasing context usage

## Background Evidence

### The Problem (from paper)
- LOCOMO/LOCCO benchmarks: Performance degrades from 0.455 → 0.05 across stages with unbounded memory
- MultiWOZ: 78.2% accuracy but 6.8% false memory rate under persistent retention
- Uncontrolled accumulation causes temporal decay and false memory propagation

### The Solution (validated)
- **Adaptive budgeted forgetting** with three signals:
  1. **Recency**: Time since last access
  2. **Frequency**: Reference count
  3. **Semantic Alignment**: Relevance to current context
- Results: F1 > 0.583 (improved from 0.455 baseline), reduced false memories, no context increase

## Application to Our System

### Current State
- Our agents use persistent context/memory across sessions
- No explicit forgetting mechanism
- Memory growth is effectively unbounded

### Proposed Implementation

```
Memory Entry Schema:
{
  content: string,
  created_at: timestamp,
  last_accessed: timestamp,
  access_count: number,
  embedding: vector,  // for semantic similarity
  importance_score: number  // computed from 3 pillars
}

Forgetting Trigger:
- When memory_size > BUDGET_LIMIT
- Evict lowest importance_score entries

Importance Score = α·recency + β·frequency + γ·semantic_alignment
```

### Success Criteria
1. **False memory rate** < 3% (vs 6.8% baseline)
2. **Long-horizon task F1** maintained > 0.58
3. **Memory size** bounded by configurable limit (e.g., 10k entries)
4. **No increase** in average context tokens per request

## Test Plan

### Phase 1: Simulation (1-2 days)
- Implement scoring algorithm on existing memory logs
- Simulate eviction under various budget constraints
- Measure retention of "important" memories (manual labels)

### Phase 2: A/B Testing (1 week)
- Deploy to 50% of agents
- Compare:
  - Task completion rates on multi-step workflows
  - User-reported "confusion" errors (proxy for false memories)
  - Memory storage growth rate

### Phase 3: Full Rollout
- If Phase 2 shows 20%+ improvement in confusion errors

## Risk: Kill Conditions

- **Kill if**: Task completion rate drops > 5% on long-horizon tasks (>10 steps)
- **Kill if**: User satisfaction scores decrease
- **Kill if**: Computational overhead > 10% per request

## Related Work
- SYNTHESIS-001: Agent Memory Architecture
- HB-0016: Novel Memory Forgetting Techniques
- HB-0112: Memory Forgetting Techniques (alternative coverage)

## Notes

This hypothesis directly addresses a known failure mode in our system: agents occasionally "hallucinate" previous context or propagate outdated information. The three-pillar approach provides a principled, evidence-backed solution.

---

*Created from arXiv:2604.02280 findings - Amy-Kimi, 2026-04-04*
