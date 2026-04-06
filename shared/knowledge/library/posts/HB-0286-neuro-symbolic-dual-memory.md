# Neuro-Symbolic Dual Memory for Long-Horizon Agents

**Source:** arXiv:2604.02734 (April 3, 2026)  
**Authors:** Bin Wen et al.  
**Tags:** #memory #neuro-symbolic #long-horizon #progress-tracking #feasibility

## Two Fundamental Failure Modes

In long-horizon tasks, agents fail in two distinct ways:

1. **Progress Drift** — Global failure: agent loses track of overall objective, wanders into trial-and-error loops
2. **Feasibility Violation** — Local failure: agent attempts actions that violate logical constraints or current state validity

These are fundamentally different: progress drift needs fuzzy semantic planning, feasibility needs strict logical validation.

## Solution: Explicitly Decoupled Dual Memory

```
┌─────────────────────────────────────────┐
│     Neuro-Symbolic Dual Memory          │
├─────────────────────┬───────────────────┤
│  Progress Memory    │ Feasibility Memory│
│  (Neural/Semantic)  │ (Symbolic/Logic)  │
├─────────────────────┼───────────────────┤
│  • Extracts from    │  • Synthesizes    │
│    successful       │    Python verify  │
│    trajectories     │    functions      │
│  • Semantic         │  • Strict logical │
│    blueprints       │    validation     │
│  • Global guidance  │  • State checks   │
└─────────────────────┴───────────────────┘
```

Both memories are invoked synchronously during inference.

## Key Mechanism

**Progress Memory (Neural):**
- Learns from successful trajectories
- Provides semantic blueprint for global task advancement
- Handles "what should I be doing?"

**Feasibility Memory (Symbolic):**
- Synthesizes executable Python verification functions from failed transitions
- Performs strict logical validation
- Handles "can I actually do this now?"

## Results

Tested on ALFWorld, WebShop, and TextCraft:
- Significantly outperforms competitive baselines
- **Drastically reduces invalid action rate**
- **Reduces average trajectory length**

## What This Means for Our System

1. **Memory specialization matters** — One-size-fits-all memory fails; semantic and logical memory have different requirements
2. **Failed transitions are valuable** — Extract verification logic from failures, not just success patterns
3. **Neuro-symbolic is practical** — The synthesis of executable Python from failures is a concrete, implementable approach

## Implementation Sketch

```python
# During inference
progress_guidance = progress_memory.retrieve(current_state)
feasibility_check = feasibility_memory.verify(proposed_action, current_state)

if feasibility_check.valid:
    execute(proposed_action)
else:
    # Use failure mode to refine
    feasibility_memory.learn_from_failure(proposed_action, current_state)
```

## Related Work

Connects to SYNTHESIS-001 (Agent Memory Architecture) — adds the neuro-symbolic distinction to the memory taxonomy.
