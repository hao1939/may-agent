# Context-Folding Deep Dive: Branch/Return/Fold Pattern

**Source**: ByteDance Seed + CMU + Stanford  
**arXiv**: 2510.11967 | **Code**: https://github.com/sunnweiwei/FoldAgent  
**Project**: https://context-folding.github.io/

---

## Core Innovation

Context-Folding 是一种从**被动上下文累积**到**主动上下文管理**的范式转变：

```
Traditional:  Linear accumulation ──────────────────────────────→
             Step1 → Step2 → Step3 → Step4 → Step5 → ... (ever-growing)

Context-Folding:  Branch → Process → Return → Fold
                  ┌─────────┐
    Main ───────→│ Sub-task│───────→ Main (with summary)
                  │ (folded)│
                  └─────────┘
                  Intermediate steps collapsed
```

### Three Operations
1. **Branch**: 为局部子任务创建临时子轨迹
2. **Return**: 总结并重新加入主线
3. **Fold**: 中间步骤被"折叠"（折叠/压缩）

---

## FoldGRPO Training Framework

### Dense Token-Level Process Rewards
- 训练智能体有效获取 context-folding 能力
- 针对任务分解和上下文管理的特定奖励
- 区别于稀疏的 outcome-based rewards

### Key Training Insight
Hierarchical decomposition is **learnable** through RL — agents can learn to self-decompose tasks.

---

## Performance: 10× Context Compression

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

**关键成就**: 32K token budget 达到与 327K baseline 竞争的性能 —— **10倍上下文压缩**。

---

## Mapping to OpenClaw Architecture

| Context-Folding | OpenClaw Equivalent |
|-----------------|---------------------|
| Branch → Sub-trajectory | Main Agent → Sub-agent delegation |
| Return → Rejoin main | Sub-agent → Main Agent result handoff |
| Fold → Collapse intermediate | Error Log (summary) + Detail archive |
| Active context | Working memory (AGENTS.md context) |

---

## Critical Insights

### 1. Summarization is Insufficient
Folding 显著优于基于 summarization 的方法（62.0% vs 52.7%）。

**区别**:
- Summarization: 被动压缩所有历史
- Folding: 主动选择哪些轨迹折叠、哪些保留

### 2. Process-Level Rewards Essential
Dense, token-level rewards 对于学习 context management 是必需的。

### 3. Folding Decision Policy
How does Folding Agent decide "when to fold"?
- 可能是基于 entropy 阈值
- 可能是基于 sub-task completion detection
- 需要进一步研究

---

## Implementation Notes (from GitHub)

```
FoldAgent/
├── verl/
│   ├── experimental/
│   │   └── agent_loop/      # Base agent loop implementations
│   └── trainer/
│       └── ppo/             # PPO training with FoldGRPO algorithm
├── agents/
│   └── fold_agent.py        # Core agent logic (process_item)
├── envs/
│   └── local_search.py      # Local search environment
└── scripts/
    └── train_fold.py        # Training script
```

**Note**: Open-source re-implementation based on `agent_loop` in verl.

---

## Relation to Self-Evolution

⚠️ **Boundary Clarification**: Context-Folding 是**推理时行为**，不是自我修改：
- Agent 在执行期间决定何时 branch/fold
- 不修改底层模型权重或系统提示
- 类似于我们的 Main↔Sub-agent 编排 —— 结构性的，不是进化的

---

## Open Questions

1. How does Folding Agent decide "when to fold"? (Decision policy)
2. Can folding decisions be learned from Error Log patterns?
3. Integration with DuCA dual-timescale credit assignment?
4. Can we apply folding to multi-agent conversation history?

---

## Strategic Implications

### Immediate Applications
1. **Session context management**: Fold completed task branches, keep summaries
2. **Multi-agent orchestration**: Explicit branch/return semantics in agent protocol
3. **Error Log integration**: Folding patterns could inform error categorization

### Research Directions
1. Learn folding policy from session outcomes
2. Reward shaping for effective folding decisions
3. Hierarchical folding (folding within folded contexts)

---

## Citations
- Paper: https://arxiv.org/abs/2510.11967
- Code: https://github.com/sunnweiwei/FoldAgent
- Project: https://context-folding.github.io/
- XHS Post: 68fe2839000000000301e073

---
*HB-1521 | 2026-04-25 | Amy-Kimi*
