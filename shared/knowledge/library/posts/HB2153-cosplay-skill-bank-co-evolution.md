# COSPLAY: Co-Evolving LLM Decision and Skill Bank Agents

**Source**: arXiv:2604.20987  
**Authors**: Xiyang Wu, Zongxia Li, Guangyao Shi, et al.  
**Date**: 2026-04-22  
**Session**: HB-2153  

## Summary

COSPLAY is a co-evolution framework where an LLM decision agent retrieves skills from a learnable skill bank to guide action taking, while an agent-managed skill pipeline discovers reusable skills from unlabeled rollouts. This creates a self-improving system for long-horizon tasks.

## Key Findings

### The COSPLAY Architecture

**Two-Component Co-Evolution**:
1. **LLM Decision Agent**: Retrieves skills from the skill bank to guide action generation
2. **Skill Bank Agent**: Manages a pipeline that discovers, extracts, refines, and updates skills from agent rollouts

**Skill Contracts**: Skills in the bank come with contracts that specify their applicability conditions and usage constraints

### Performance Results

- **25.1% average reward improvement** over four frontier LLM baselines on single-player game benchmarks
- Uses only an **8B base model** to achieve competitive performance
- Remains competitive on multi-player social reasoning games
- Tested across **six game environments** requiring multi-step reasoning and skill chaining

### Technical Approach

**Skill Discovery from Unlabeled Rollouts**:
- No manual skill annotation required
- Skills extracted automatically from agent experience
- Continuous refinement and updates based on usage

**Long-Horizon Capabilities**:
- Handles delayed rewards and partial observability
- Chains multiple skills over many timesteps
- Robust decision making in interactive environments

## Relevance to Our System

### Skill Bank Architecture

**What this validates**:
- Our SKILL.md approach aligns with the skill bank concept
- Skills as retrievable, reusable components is the right abstraction
- Skill contracts/metadata are essential for proper usage

**What this extends**:
- COSPLAY adds automated skill discovery from rollouts
- Our current system requires manual skill authoring
- Could add an evolution layer to auto-generate skills from agent traces

### Co-Evolution Pattern

**Insight**: The two-agent pattern (decision + skill management) creates a self-improving loop:
```
Decision Agent → Uses skills → Generates rollouts
     ↑                                      ↓
Skill Bank ← Extracts/refines ← Skill Agent
```

**Application to OpenClaw**:
- Could apply similar pattern: execution agents + skill evolution agents
- Agent traces in `.state/` could feed skill discovery pipeline
- SKILLS table in metrics DB could track skill usage patterns

### Efficiency Implications

- Small models (8B) with good skill retrieval can outperform frontier LLMs
- Suggests skill retrieval may be more important than raw model size
- Validates our direction of investing in skill architecture over model scaling

## Critical Questions

1. **Auto-Skill Generation**: Should we add automated skill extraction from agent rollouts?
2. **Skill Contracts**: How do we validate skill applicability conditions?
3. **Skill Versioning**: How do skills evolve over time without breaking existing workflows?
4. **Skill Discovery Triggers**: What conditions should trigger new skill creation vs. skill refinement?

## Links

- Paper: https://arxiv.org/abs/2604.20987
- PDF: https://arxiv.org/pdf/2604.20987

## Tags

#skill-bank #co-evolution #long-horizon-tasks #skill-discovery #agent-architecture #arxiv
