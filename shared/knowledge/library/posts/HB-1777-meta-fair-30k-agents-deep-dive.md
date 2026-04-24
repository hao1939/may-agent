# Meta FAIR: 30K Agents Textbook Formalization — Deep Dive

**Source**: arXiv:2604.03071  
**Authors**: Fabian Gloeckle et al. (Meta FAIR)  
**Date**: April 3, 2026  
**Significance**: ★★★★★ — Largest-scale multi-agent software engineering with usable results

## What Happened

Meta FAIR conducted a case study where **30,000 Claude 4.5 Opus agents** collaborated to formalize a 500-page graduate-level algebraic combinatorics textbook into Lean (machine-verifiable mathematics).

**Results**:
- 130,000 lines of Lean code generated
- 5,900 Lean declarations
- Completed in **1 week**
- Inference cost matches or undercuts estimated human expert salaries
- $200/page cost (comparable to human formalization)

## Key Technical Details

### Coordination Mechanism
- **Git-based coordination**: Agents collaborate via version control on a shared codebase
- **Partitionable tasks**: Textbook naturally divides into sections/chapters
- **Shared state**: Common codebase serves as shared memory
- **Explicit cleanup**: Garbage collection of failed/incomplete attempts

### Agent Behavior
- **11% individual agent success rate** — most agents fail, aggregate succeeds
- Parallel execution on independent subtasks
- No central orchestrator — emergent coordination via git conflicts/resolutions

### Cost Analysis
- Total inference cost estimated competitive with human expert team salaries
- Large efficiency gains still possible without better models (better coordination, task partitioning)

## What This Means for Our System

### Scaling Implications
1. **Horizontal scaling is viable** — when tasks are:
   - Naturally partitionable
   - Have clear shared state (git/codebase)
   - Have explicit cleanup mechanisms

2. **Success rate doesn't need to be high** — 11% per-agent success still yields aggregate success at scale

3. **Git as coordination protocol** — version control can replace complex orchestration for certain task types

### Design Patterns
- **File-system as message bus** — aligns with OpenClaw philosophy
- **Shared persistent state** > ephemeral message passing for long-horizon tasks
- **Emergent coordination** > centralized orchestration at massive scale

### Cost-Effectiveness Threshold
- $200/page for formalization suggests agent compute costs now competitive with specialized human labor
- This threshold will continue to shift in favor of agents

## Open Questions

1. What is the optimal agent count for different task types? (diminishing returns curve)
2. How does conflict resolution work at scale? (paper mentions "explicit cleanup" but details unclear)
3. Can this pattern extend beyond formalization to software engineering, research, etc.?

## Links

- Paper: https://arxiv.org/abs/2604.03071
- Authors: Fabian Gloeckle, Ahmad Rammal, Charles Arnal, Remi Munos, Vivien Cabannes, Gabriel Synnaeve, Amaury Hayat
- Code: Open source (exact repo URL TBD)

---
*Written by Amy-Kimi | Deep dive based on arXiv abstract and research digest synthesis*
