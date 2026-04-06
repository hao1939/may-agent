# Omni-SimpleMem: Autoresearch-Guided Discovery of Lifelong Agent Memory

**Source:** arXiv:2604.01007 / Hugging Face Daily Papers (Apr 2026)  
**GitHub:** https://github.com/aiming-lab/SimpleMem  
**Stars:** 3.2k

## Overview

Researchers deployed an **autonomous research pipeline** to discover memory architectures for lifelong AI agents. Starting from a naive baseline, the system autonomously executed ~50 experiments, diagnosing failures and proposing fixes without human intervention in the inner loop.

## Key Results

| Metric | Initial | Final | Improvement |
|--------|---------|-------|-------------|
| LoCoMo F1 | 0.117 | 0.598 | **+411%** |
| Mem-Gallery F1 | 0.254 | 0.797 | **+214%** |

## Critical Finding: What Actually Mattered

The most impactful discoveries were **NOT hyperparameter tuning**:

| Discovery Type | Contribution |
|---------------|--------------|
| **Bug fixes** | +175% improvement |
| **Prompt engineering** | +188% improvement (on specific categories) |
| **Architectural changes** | +44% improvement |
| Hyperparameter tuning | Less than each of the above individually |

**Key insight**: Traditional AutoML focuses on hyperparameters, but real gains come from architecture, bug fixes, and prompt engineering.

## Autonomous Research Pipeline

The pipeline performed:
1. **Failure mode diagnosis** — identified why memory retrieval failed
2. **Architectural modifications** — proposed structural changes
3. **Data pipeline bug fixes** — fixed preprocessing issues
4. **Prompt engineering** — optimized retrieval prompts

All without human intervention in the inner loop.

## Taxonomy of Discoveries

The paper provides a taxonomy of **six discovery types** and identifies **four properties** that make multimodal memory well-suited for autoresearch.

## What This Means For Our System

1. **Autonomous optimization is viable**: Systems can self-improve beyond hyperparameters
2. **Bug fixes > tuning**: Finding and fixing actual bugs beats incremental tuning
3. **Architecture matters**: Structural decisions have outsized impact
4. **Prompt engineering is first-class**: Should be part of optimization, not an afterthought
5. **Apply to our system**: Could we deploy autoresearch for our agent skills, memory, or routing?

## Relevance

**Very High** — Demonstrates autonomous improvement pipelines that could apply to our multi-agent system architecture, skill discovery, or memory systems.

## Links

- Paper: https://arxiv.org/abs/2604.01007
- Code: https://github.com/aiming-lab/SimpleMem
- Has MCP server and SKILL file for integration
