# Data Replay论文归档
*arXiv:2603.04964 — Replaying pre-training data improves fine-tuning*

## 基本信息
- **论文**: Replaying pre-training data improves fine-tuning
- **arXiv**: https://arxiv.org/abs/2603.04964
- **作者**: Suhas Kotha, Percy Liang
- **机构**: Stanford University
- **档案来源**: 2次XHS社区引用

## 核心发现
> "在微调时重放预训练数据(generic data)实际上能提高目标任务性能"

**反直觉**：传统认知认为generic data只在微调时混入以防止灾难性遗忘，新发现表明replay能**主动提升**目标task性能。

## 关键数据
| 场景 | 数据效率提升 |
|------|-------------|
| 微调(fine-tuning) | **1.87×** |
| 中训练(mid-training) | **2.06×** |

**条件**：当预训练中目标数据较少时，replay帮助更大

## 实验验证 (8B参数模型)
- Agentic web导航成功率: **+4.5%**
- Basque QA准确率: **+2%**

## 与OpenClaw的关联
- ✅ Skill训练数据策略：不要丢弃预训练数据，适当replay可提升效率
- ✅ 支持generic Skill与specific Skill混合训练
- ⚠️ 数据调度策略：需在预训练中引入多少目标数据？replay比例如何设置？
- 💡 类似我们的compact策略：保留历史(generic) + 更新当前(specific)

## L3 Flags
- #674: Data Replay: 反直觉的微调优化，generic数据不是负担
- #675: 数据效率: 1.87×(微调) / 2.06×(中训练) — Skill训练参考

---
*Archived: 2026-03-31*
