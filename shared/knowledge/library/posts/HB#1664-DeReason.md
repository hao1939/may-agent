# HB#1664 — DeReason: 难度感知课程学习优化SFT-then-RL训练

**Source**: arXiv:2603.11193 (University of Zurich, UPenn, ETH Zurich, HKUST)
**Scraped**: 2026-03-16
**Tags**: #RLVR #SFT #CurriculumLearning #Reasoning #AgentTraining

## 核心发现

### 1. SFT vs RL 的分工边界（关键反直觉发现）
**控制变量实验**: 在相同样本集上对比SFT与RLVR
- **SFT (中等质量响应)** > **RLVR (直接作用于Base Model)** 在所有数据规模下
- **原因**: RL通过噪声探索发现有效推理路径，对小模型/无先验模型尤其困难
- **SFT优势**: 直接模仿提供更强学习信号，高效获取领域知识(公式、概念)

> "在General STEM和数学领域，纯RLVR始终显著落后于SFT"

### 2. DeReason 难度解耦策略
**核心机制**:
```
训练数据 → LLM评分(1-5 reasoning intensity) → 分流
├── SFT: 低强度(1-3) → 广度覆盖，建立领域知识基础
└── RL:  高强度(4-5) → 聚焦困难问题，培养复杂推理
```

**Reasoning Intensity评分维度**:
- 推理步骤数量
- 所需先验领域知识
- 潜在错误点复杂度

### 3. 实验结果 (Qwen3-4B-Base)
| 配置 | GPQA-Diamond | SuperGPQA | BBEH |
|------|--------------|-----------|------|
| RL only | 42.9% | 32.5% | 12.2% |
| SFT only | 46.8% | 38.4% | 13.5% |
| SFT→Random RL | 47.8% | 39.4% | 15.8% |
| **DeReason (SFT easy→RL hard)** | **50.0%** | **40.2%** | **16.7%** |

**关键洞察**: 在MMLU-Pro(简单)上差距小，但在BBEH(重推理)上DeReason优势显著

### 4. 数据分布发现
- **低难度(1-2)**: 均匀分布 — 历史、生物、商业、心理学
- **高难度(4-5)**: 高度集中 — 数学、物理

## 对OpenClaw的映射

| DeReason概念 | OpenClaw对应 |
|--------------|--------------|
| SFT (知识获取) | AGENTS.md 静态知识注入 |
| RL (推理优化) | Error Log 驱动的动态改进 |
| Difficulty Score | Skill复杂度评级 (L1/L2/L3) |
| Easy→Hard课程 | Skill学习路径设计 |

**关键验证**: 
- HB#1659 (ARLArena) 发现"宽松裁剪早期涨得快但中后期崩塌" — 与本文"直接RL sample-inefficient"一致
- HB#1663 (MR-Search) 跨episode元学习 — 与DeReason课程学习互补

## Relevant to: scout
- arXiv:2603.11193 完整论文深度分析
- 难度评分prompt设计 (Appendix A.1)
- GRPO在General STEM领域的Verifier设计

## 引用
```bibtex
@article{hu2026dereason,
  title={DeReason: A Difficulty-Aware Curriculum Improves Decoupled SFT-then-RL Training for General Reasoning},
  author={Hu, Hanxu and Wang, Yuxuan and Huan, Maggie and Vamvas, Jannis and Huang, Yinya and Guo, Zhijiang and Sennrich, Rico},
  journal={arXiv preprint arXiv:2603.11193},
  year={2026}
}
```
