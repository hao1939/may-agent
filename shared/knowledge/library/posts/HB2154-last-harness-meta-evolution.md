# The Last Harness You'll Ever Build: Automated Harness Engineering

**Source**: arXiv:2604.21003  
**Authors**: Haebin Seong, Li Yin, Haoran Zhang  
**Date**: 2026-04-22  
**Session**: HB-2154  

## Summary

A two-level framework that automates harness engineering: (1) Harness Evolution Loop optimizes worker agents for single tasks, and (2) Meta-Evolution Loop learns the best evolution protocol across tasks—enabling zero human harness engineering for new domains.

## Key Findings

### The Problem: Harness Engineering Tax

**Current Reality**: Each new task domain requires painstaking, expert-driven harness engineering:
- Designing prompts
- Building tools  
- Writing orchestration logic
- Creating evaluation criteria

**The Cost**: Domain experts must become harness engineering experts, or vice versa.

### Two-Level Framework

**Level 1: Harness Evolution Loop** (Single Task Optimization)
```
Worker Agent W_H → Executes task → Produces results
                        ↓
Evaluator Agent V → Adversarially diagnoses failures → Scores performance
                        ↓
Evolution Agent E → Modifies harness H → Next iteration
```

Components:
- **Worker Agent** W_ℋ: Executes tasks with harness ℋ
- **Evaluator Agent** V: Adversarially finds failure modes, scores performance
- **Evolution Agent** E: Modifies harness based on full history

**Level 2: Meta-Evolution Loop** (Protocol Optimization)
- Learns the evolution protocol Λ = (W_ℋ, ℋ⁽⁰⁾, V, E) across diverse tasks
- Finds Λ^(best) that enables rapid harness convergence on any new task
- **No human harness engineering required for new domains**

### Key Innovation

**Meta-Learning for Harness Evolution**:
- Formalizes correspondence to meta-learning
- Learns how to learn harnesses
- Protocol adaptation becomes automatic

**The Shift**:
```
Manual Harness Engineering → Automated Harness Engineering → Automated Design of Automation
```

## Relevance to Our System

### Harness Evolution Loop

**Parallel to Our System**:
- Our agents = Worker Agents
- Our metrics/evaluators = Evaluator Agents  
- Our AGENTS.md + skill updates = Harness Evolution

**What's New**:
- Explicit adversarial evaluation (Evaluator Agent V)
- Full history consideration (not just last failure)
- Structured evolution protocol

### Meta-Evolution Loop

**Insight**: Don't just evolve one harness—evolve the *process* of evolution.

**Application**:
- Our workflow patterns could be learned, not hardcoded
- Agent selection, tool routing, evaluation criteria could adapt per task type
- Project templates could auto-optimize based on outcomes

### Current Gap Analysis

**What we have**:
- ✓ Worker agents (Claude-based execution)
- ✓ Evaluation (metrics DB, session tracking)
- ✓ Some evolution (skill updates, AGENTS.md refinement)

**What's missing**:
- ✗ Explicit adversarial evaluator agent
- ✗ Full history-based evolution (we track but don't fully leverage)
- ✗ Meta-learning of evolution protocols

## Critical Questions

1. **Adversarial Evaluator**: Should we add a dedicated "red team" agent that tries to break our agents?
2. **History Leverage**: How can we better use `.state/sessions/` data for harness improvement?
3. **Protocol Learning**: Could we learn optimal agent selection/tool routing per task type?
4. **Auto-Template**: Could project templates auto-evolve based on success patterns?

## Practical Applications

### For Our Agent System

**Harness Evolution**:
- Agent execution patterns → Evaluator finds failure modes → Skill updates → New iteration
- Prompt refinement through structured feedback
- Tool selection optimization

**Meta-Evolution**:
- Learn best agent-tool combinations per task category
- Optimize orchestration patterns (sequential vs parallel)
- Auto-tune evaluation criteria thresholds

### For Our Users

- New project types get automatically optimized harnesses
- No manual prompt engineering for new domains
- Continuous improvement as more tasks are completed

## Links

- Paper: https://arxiv.org/abs/2604.21003
- PDF: https://arxiv.org/pdf/2604.21003

## Tags

#harness-engineering #meta-learning #automated-evolution #agent-optimization #arxiv #system-design
