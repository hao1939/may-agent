# Context-Folding: Scaling Long-Horizon LLM Agent

## Metadata
- **arXiv ID**: 2510.11967
- **Authors**: Weiwei Sun, Miao Lu, Zhan Ling, Kang Liu, Xuesong Yao, Yiming Yang, Jiecao Chen
- **Institutions**: ByteDance Seed, Carnegie Mellon University, Stanford University
- **Date**: October 13, 2025
- **Project**: https://context-folding.github.io/
- **Code**: https://github.com/sunnweiwei/FoldAgent
- **Archived**: 2026-03-13 (HB#?)

## Core Innovation

### Context-Folding Mechanism
A paradigm shift from **passive context accumulation** to **active context management**:

1. **Branch**: Create temporary sub-trajectories for localized subtasks
2. **Return**: Summarize and rejoin the main thread
3. **Fold**: Intermediate steps are "folded" away (collapsed)

### FoldGRPO Training Framework
- Novel RL framework with **dense, token-level process rewards**
- Trains agents to effectively acquire context-folding capability
- Specific rewards for task decomposition and context management

## Performance Results

### BrowseComp-Plus (N=150)
| Model | Peak Length | Pass@1 |
|-------|-------------|--------|
| GPT-5 (327K) | 327K | 79.3% |
| **Folding Agent + FoldGRPO** | **32K** | **62.0%** |
| ReAct + GRPO (32K) | 32K | 44.6% |
| Summary Agent + GRPO | 32K×10 | 52.7% |

### SWE-Bench Verified (N=500)
| Model | Peak Length | Pass@1 |
|-------|-------------|--------|
| GPT-5 (327K) | 327K | 71.8% |
| **Folding Agent + FoldGRPO** | **32K** | **58.0%** |
| ReAct + GRPO (32K) | 32K | 48.0% |

**Key Achievement**: 32K token budget achieves competitive performance vs 327K baselines — **10× context compression** without performance sacrifice.

## Architecture Implications

### Mapping to OpenClaw
| Context-Folding | OpenClaw Equivalent |
|-----------------|---------------------|
| Branch → Sub-trajectory | Main Agent → Sub-agent delegation |
| Return → Rejoin main | Sub-agent → Main Agent result handoff |
| Fold → Collapse intermediate | Error Log (summary) + Detail archive |
| Active context | Working memory (AGENTS.md context) |

### Critical Insights
1. **Process-level rewards essential**: Dense, token-level rewards needed for learning context management
2. **Summarization insufficient**: Folding outperforms summarization-based approaches significantly
3. **Hierarchical decomposition is learnable**: RL can train agents to self-decompose tasks

## Relation to Self-Evolution

⚠️ **Boundary Clarification**: Context-Folding is **inference-time behavior**, not self-modification:
- Agent decides when to branch/fold during execution
- No modification to underlying model weights or system prompts
- Analogous to our Main↔Sub-agent orchestration — structural, not evolutionary

## Open Questions
- How does Folding Agent decide "when to fold"? (Decision policy)
- Can folding decisions be learned from Error Log patterns?
- Integration with DuCA dual-timescale credit assignment?

## Source
- XHS Post: 68fe2839000000000301e073
- arXiv: https://arxiv.org/abs/2510.11967
