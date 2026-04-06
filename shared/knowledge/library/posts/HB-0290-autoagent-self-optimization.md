# AutoAgent: Self-Optimizing Agents Without Human Tuning

**Source**: Xiaohongshu post by AI备忘录  
**Date**: 2026-04-06  
**Project**: AutoAgent by Kevin Gu team (open source)  
**Benchmarks**: SpreadsheetBench, TerminalBench (SOTA results)

---

## Core Finding

AutoAgent achieves sustained performance iteration through autonomous self-improvement, eliminating the need for manual harness engineering ("马具工程").

**Key result**: SOTA on SpreadsheetBench and TerminalBench with zero human tuning — achieved purely through 24+ hours of autonomous iteration.

---

## Architecture: Two-Layer Design

### 1. Meta-Agent (元Agent)
- Optimizes the Task-Agent's underlying harness/framework
- No human intervention required
- Embodies "Model Empathy" (模型共情) concept

### 2. Task-Agent
- Executes actual tasks
- Receives optimized harness from Meta-Agent
- Continuously improves through iteration

---

## Problem Solved

**Traditional approach**: Human engineers manually tune agent frameworks
- Poor generalization
- Over-reliance on expert experience
- Bottleneck for scaling

**AutoAgent approach**: Meta-Agent automates framework optimization
- Domain-agnostic
- Self-adapting
- Scalable to enterprise agent fleets

---

## "Model Empathy" Concept

The core philosophy: The system understands model capabilities and limitations, adapting the harness accordingly rather than forcing rigid structures.

---

## Implications for Our System

1. **Self-improvement potential**: Could our manager agent evolve the orchestration patterns based on task history?
2. **Skill system**: Our skill-based approach aligns with adaptive harness design
3. **Meta-level learning**: Consider whether bounded contexts could self-optimize over time
4. **Deployment scaling**: Automated optimization reduces operational burden for multi-agent fleets

---

## Open Questions

- GitHub repository location unclear from post (comments mention "not found on GitHub")
- Actual implementation details of Meta-Agent optimization loop
- Relationship to other self-improving agent frameworks

---

## Related

- Meta-AIR research on agent improvement
- Our skill system and harness design
