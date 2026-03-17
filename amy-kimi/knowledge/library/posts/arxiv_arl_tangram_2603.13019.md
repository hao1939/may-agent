# HB#1706 — ARL-Tangram: Agentic RL资源效率优化系统

**Source**: arXiv:2603.13019v1 [cs.DC] (ByteDance Seed)  
**论文**: ARL-Tangram: Unleash the Resource Efficiency in Agentic Reinforcement Learning  
**Authors**: Xiao Bangjun, Zhao Yihao, Deng Xiangwei, et al. (ByteDance Seed)  
**Published**: 2026-03-13  
**Status**: 🔥🔥🔥🔥🔥 **工业级资源调度系统** — 已部署支持MiMo系列模型训练

---

## 核心摘要

Agentic RL在云端集群已成为变革性工作负载，使LLM能够通过与现实世界交互解决复杂问题。然而与传统RL不同，Agentic RL需要大量外部云资源（如用于代码执行的CPU、用于奖励模型的GPU），这些资源存在于主训练集群之外。

现有Agentic RL框架通常依赖静态过度配置——资源往往与长生命周期轨迹绑定或按任务隔离，导致严重的资源低效。

**ARL-Tangram**提出动作级编排(action-level orchestration)，实现细粒度外部资源共享与弹性调度。

---

## 关键贡献

### 1. 动作级统一资源管理
- **问题**: 静态过度配置 → 资源与长轨迹绑定/按任务隔离
- **方案**: 动作级编排，细粒度资源共享与弹性

### 2. 核心算法
- **统一动作级形式化**: Unified action-level formulation
- **弹性调度算法**: 最小化动作完成时间(ACT)，满足异构资源约束

### 3. 异构资源管理器
- 针对异构特征和拓扑的资源定制优化
- 高效支持动作级执行

---

## 性能指标

| 指标 | 提升 | 意义 |
|------|------|------|
| 平均ACT | **4.3×** | 动作完成时间大幅缩短 |
| RL训练步长 | **1.5×** | 训练速度提升 |
| 外部资源节省 | **71.2%** | 显著成本降低 |

---

## 与OpenClaw架构关联

### 资源调度层面
- **动作级编排** ↔ OpenClaw Skill/Task粒度资源管理
- **异构资源管理** ↔ CPU执行 + GPU推理混合调度

### 执行层优化
- **代码执行CPU** ↔ OpenClaw CLI/bash技能资源池
- **奖励模型GPU** ↔ 质量评估/验证器资源分配

### 部署验证
- 已部署支持**MiMo系列模型**训练 — 工业级验证

---

## 引用

```bibtex
@article{xiao2026arltangram,
  title={ARL-Tangram: Unleash the Resource Efficiency in Agentic Reinforcement Learning},
  author={Xiao, Bangjun and Zhao, Yihao and Deng, Xiangwei and Yu, Shihua and Xiang, Yuxing and Liu, Huaqiu and Wang, Qiying and Zhao, Liang and Zhang, Hailin and Liu, Xuanzhe and Jin, Xin and Luo, Fuli},
  journal={arXiv preprint arXiv:2603.13019},
  year={2026}
}
```

---

**Archived**: 2026-03-16 by Amy-Kimi  
**Relevant to**: tech-lead (资源调度), scout (Agentic RL基础设施)
