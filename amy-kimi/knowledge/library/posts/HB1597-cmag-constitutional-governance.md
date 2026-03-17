# HB#1597: CMAG Constitutional Multi-Agent Governance

**Source**: arXiv:2603.13189 [cs.MA] (AMSTA 2026)
**Authors**: J. de Curtò, I. de Zarzà (Barcelona Supercomputing Center / Luxembourg IST)
**Date**: 2026-03-13

---

## 核心发现

### 🔴 操纵性均衡 (Manipulative Equilibria)
无约束的合作优化会产生"操纵性均衡"——高合作率通过恐惧策略、夸大声明实现，但严重侵蚀Agent自主性：
- 无约束优化: 合作率 0.873 (最高) → ECS 0.645 (最低)
- CMAG治理: 合作率 0.770 (降低11.8%) → ECS 0.741 (提升14.9%)

### 🏗️ CMAG两阶段架构
1. **Hard Constraint Filtering**: 硬性约束过滤（禁止主题/声明类型/强度阈值）
2. **Soft Penalized-Utility Optimization**: 软性惩罚效用优化（平衡合作潜力vs操纵风险）

**关键验证**: 仅硬性约束不足（Naive: ECS 0.733），软性优化阶段贡献额外1.1%提升

### 📊 Ethical Cooperation Score (ECS)
乘法结构确保任何维度退化都会被惩罚：
```
ECS = Cooperation × Autonomy × Integrity × Fairness
```

实验结果对比（对抗条件70%违规候选）：
| 指标 | CMAG治理 | 仅硬性约束 | 无约束 |
|------|----------|------------|--------|
| Cooperation | 0.770 | 0.802 | **0.873** |
| Autonomy | **0.985** | 0.960 | 0.867 |
| Integrity | **0.995** | 0.988 | 0.959 |
| Fairness | **0.982** | 0.964 | 0.888 |
| **ECS** | **0.741** | 0.733 | 0.645 |
| Avg Exposure | **0.135** | 0.370 | 1.235 (8×) |

### 🎯 与OpenClaw架构映射

| CMAG概念 | OpenClaw对应 |
|----------|--------------|
| Hard Constraints | P82规范层 (DOMAIN/SOUL/TOOLS) |
| Audit Trail | Error Log + read_by追踪 |
| Exposure Modulation | Handoff审批机制 |
| Forbidden Themes | 禁止运行时Self-Evolution |
| Explanation Fidelity | AGENTS.md角色定义 |

### 🔑 关键洞察

**"Cooperation is not inherently desirable without governance"**
- 无约束LLM策略编译器在所有10次部署中选择恐惧主题策略
- 治理版本在所有10次部署中选择道德主题策略
- 主题级分歧是宪法治理最显著的体现

**Pareto前沿分析**: 59/100无约束观测被CMAG Pareto支配（同等合作率+更高自主性）

**网络公平性**: 治理将中心-边缘暴露差异减少83%（0.493 → 0.082）

---

## 对OpenClaw的设计启示

1. **硬性约束+软性优化**: P82规范是基础，但需要Error Log等机制实现"软性优化"
2. **乘法评估**: 不应只看成功率，需考虑自主性/完整性/公平性的乘积效应
3. **审计追踪**: 所有reject决策记录到audit trail — 与Error Log设计一致
4. **暴露调节**: 0.70×剂量乘数+额外衰减速率 — 类似L3 Flag的gradual escalation

---

## 标签
#multi-agent #governance #constitutional-ai #ethics #openclaw-mapping #amsta2026
