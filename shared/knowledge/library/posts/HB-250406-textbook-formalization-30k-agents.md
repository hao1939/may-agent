# Automatic Textbook Formalization: 30K Agents in Parallel

**Source:** arXiv:2604.03071 (April 3, 2026)  
**Authors:** Fabian Gloeckle et al. (FAIR, Meta + ENPC + KIAS)  
**Links:** [arXiv](https://arxiv.org/abs/2604.03071) | [Code](https://github.com/facebookresearch/repoprover) | [Lean Code](https://github.com/facebookresearch/algebraic-combinatorics)

## The Achievement

30,000 Claude 4.5 Opus agents collaborated in parallel to formalize a **500+ page graduate-level algebraic combinatorics textbook** to Lean in **one week**.

**Scale:**
- 130,000 lines of code generated
- 5,900 Lean declarations
- 340 target theorems and definitions
- Cost competitive with human expert salaries

## Architecture: Version-Control-Based Multi-Agent

Unlike typical multi-agent orchestration, this system uses **git version control** as the coordination mechanism:

```
┌─────────────────────────────────────────────┐
│        Shared Codebase (Git)               │
├─────────────────────────────────────────────┤
│  Agent 1 ──┐                                │
│  Agent 2 ──┼──→ Commit → Merge → Main     │
│  Agent 3 ──┤                                │
│    ...     │   (Each agent works on         │
│  Agent 30K─┘    separate branch)           │
└─────────────────────────────────────────────┘
```

## Two-Phase Process

**Phase 1: Continuous Expansion**
- Agents independently add content
- Includes "unnecessary rabbit hole content"
- Codebase grows organically

**Phase 2: Cleanup (Prompt-Triggered)**
- System-wide prompt update triggers cleanup
- Consolidation and removal of redundant content
- Final output: all 340 targets present and proved

## Key Insights

### 1. Scaling Through Parallelism
30K parallel agents demonstrates that **massive horizontal scaling** is viable when:
- Work is partitionable (different theorems/definitions)
- Coordination happens through shared state (git)
- Conflicts are resolvable through version control

### 2. Cost Efficiency
The inference cost "matches or undercuts" estimated human expert salaries, with "potential for large efficiencies without better models."

### 3. Quality Through Iteration
Not a single-pass generation but an **iterative process** with explicit cleanup phases. Quality emerges from refinement, not just scale.

## Implications for Our System

**For Multi-Agent Architecture:**
- Git/version control as coordination mechanism vs. message passing
- Partition-then-merge pattern for divisible tasks
- Explicit cleanup/consolidation phases required

**For Cost Modeling:**
- Massive parallel agent deployment can be cost-competitive with experts
- Iteration beats single-shot generation

**For Agent Scaling:**
- 30K agents working in parallel shows the upper bound of horizontal scaling
- Key challenge: partitionability of the task domain

## Cross-Reference

- Thread #10: Multi-Agent范式之争 - This demonstrates massive-scale parallel multi-agent success
- Thread #13: Long-Horizon Agent Coherence - One-week duration with 30K agents shows long-horizon coordination is possible with proper architecture
- InfoSeeker (HB-250406): Hierarchical parallel agent with strict context isolation - complementary approaches to coordination
