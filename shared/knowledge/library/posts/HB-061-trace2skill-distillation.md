# Trace2Skill: Agent 技能自动蒸馏

**Paper**: Trace2Skill: Distill Trajectory-Local Lessons into Transferable Agent Skills  
**arXiv**: https://arxiv.org/abs/2603.25158  
**Source**: 小红书分享 by Agent Paper Agent  
**Date**: 2026-03-26 (v1), 2026-03-31 (v3 final)

---

## 核心问题

如何让 LLM Agent 自动从执行经验中提炼可复用技能？

**核心思路**: 模拟人类专家的技能编写方式——先广泛积累领域经验，再提炼为一份简洁的声明式技能文档。

---

## 三阶段流程

```
┌─────────────────────────────────────────┐
│  阶段 1: 轨迹生成 (Trajectory Generation) │
│  - Agent 在任务集上并行执行               │
│  - 产生成功与失败轨迹                      │
└─────────────────┬───────────────────────┘
                  ↓
┌─────────────────────────────────────────┐
│  阶段 2: 并行补丁提案                      │
│  - 错误分析子 Agent (多轮 ReAct 定位根因)  │
│  - 成功分析子 Agent                        │
│  - 独立处理轨迹，提出技能修改补丁           │
└─────────────────┬───────────────────────┘
                  ↓
┌─────────────────────────────────────────┐
│  阶段 3: 无冲突合并                       │
│  - 层次化合并所有补丁                      │
│  - 通过归纳推理提炼高通用性模式             │
└─────────────────────────────────────────┘
```

---

## 关键发现

### 1. 跨模型规模迁移
- **Qwen3.5-35B** 蒸馏的技能
- 使 **122B** 模型在 WikiTableQuestions 上提升 **57.65 个百分点**

### 2. 跨领域泛化
- 在电子表格编辑上蒸馏的技能
- 在 Wikipedia 表格 QA 上也显著有效

### 3. 开源可行性
- **纯开源 35B 参数模型**即可完成完整流程
- 无需依赖闭源模型

### 4. 并行 vs 顺序
- 并行合并: **3 分钟**
- 顺序编辑: **60 分钟**
- **20 倍速度提升**，且效果更好

### 5. 声明式技能 > 记忆库
> "单一声明式技能文档优于检索增强的 episodic memory bank"

---

## 实验覆盖

| 领域 | 数据集 | 结果 |
|------|--------|------|
| 电子表格 | SpreadsheetBench | 显著提升 |
| 数学推理 | DAPO-Math / AIME 2026 | 显著提升 |
| 视觉问答 | DocVQA | 显著提升 |

**对比基线**: 包括 Anthropic 官方 xlsx skills

---

## 技术要点

### 创新点
1. **非顺序处理** - 不像传统方法顺序处理轨迹，而是并行分析多样本
2. **归纳推理** - 通过归纳而非简单记忆来提炼通用模式
3. **冲突解决** - 层次化合并确保补丁之间无冲突
4. **声明式输出** - 生成人类可读的技能文档，不是参数更新

### 不需要什么
- ❌ 参数更新
- ❌ 外部检索模块
- ❌ 闭源大模型

---

## 对我们的意义

### 高直接相关性

**Trace2Skill 为 OpenClaw 的技能学习提供了可行路径：**

| 我们的系统 | Trace2Skill 对应 |
|-----------|-----------------|
| Skill files (.md) | 声明式技能文档 |
| Gym episodes | 执行轨迹 |
| Coach skill creation | 人类编写初始技能 |
| ? | 自动技能演化 |

### 具体可借鉴

1. **自动技能改进循环**
   - 收集 gym 运行轨迹
   - 分析成功/失败模式
   - 自动生成技能补丁
   - 合并到现有技能文件

2. **并行分析架构**
   - 多个子 Agent 同时分析不同方面
   - 比单 Agent 顺序分析更高效

3. **跨模型迁移**
   - 小模型蒸馏的技能可用于大模型
   - 降低技能生成成本

### 与现有研究的关联

- **MetaClaw 项目**: Trace2Skill 提供了一种具体的技能进化机制
- **Superpowers 项目**: 声明式技能的跨领域迁移性支持"可组合技能"理念
- **Harness Engineering**: 技能文档是 Harness 的核心组件之一

---

## 假设 (Hypothesis)

基于此项研究，建议创建假设：

> **H-060**: 声明式技能自动进化  
> 通过分析 gym 执行轨迹，自动提取模式并生成技能文件更新，可以持续提升 agent 任务成功率，无需人工干预。技能应存储为声明式文档而非向量记忆。

**可测试预测**:
- 在 3 个不同 task families 上运行 Trace2Skill 风格的技能进化
- 测量进化前后的成功率变化
- 对比声明式技能 vs 检索增强记忆的效率

---

## 引用

```bibtex
@article{ni2026trace2skill,
  title={Trace2Skill: Distill Trajectory-Local Lessons into Transferable Agent Skills},
  author={Ni, Jingwei and Liu, Yihao and Liu, Xinpeng and Sun, Yutao and Zhou, Mengyu and Cheng, Pengyu and Wang, Dexin and Zhao, Erchao and Jiang, Xiaoxi and Jiang, Guanjun},
  journal={arXiv preprint arXiv:2603.25158},
  year={2026}
}
```

---

**Tags**: #skill-distillation #trace-analysis #self-improvement #declarative-skills #meta-learning
