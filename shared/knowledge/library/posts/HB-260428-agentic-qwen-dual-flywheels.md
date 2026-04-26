# AgenticQwen: 小模型Agent的双数据飞轮训练框架

**Source**: arXiv (Apr 23, 2026)  
**Paper**: arXiv:2604.21590  
**Code**: https://github.com/haruhi-sudo/data_synth_and_rl  
**Models**: https://huggingface.co/collections/alibaba-pai/agenticqwen  
**Authors**: Yuanjie Lyu, Chengyu Wang, Haonan Zheng, et al. (Alibaba PAI)

---

## 核心贡献

**AgenticQwen** 是阿里巴巴PAI团队提出的小模型Agent训练框架，通过**双数据飞轮**（Dual Data Flywheels）自动生成日益复杂的训练任务，在工业级Agent场景中实现了接近大模型的性能。

---

## 技术架构

### 双数据飞轮设计

```
┌─────────────────────────────────────────────────────────────┐
│                    AgenticQwen 训练框架                      │
├─────────────────────────────┬───────────────────────────────┤
│      Reasoning Flywheel     │       Agentic Flywheel        │
│        (推理飞轮)            │         (智能体飞轮)           │
├─────────────────────────────┼───────────────────────────────┤
│ • 从错误中学习增加任务难度    │ • 将线性工作流扩展为多分支      │
│ • 多轮强化学习优化推理能力    │ • 行为树反映真实决策复杂度      │
│ • 合成数据+开源数据混合训练   │ • 支持复杂工具调用和规划        │
└─────────────────────────────┴───────────────────────────────┘
```

### 训练流程

1. **推理RL** (Reasoning RL): 提升多步推理能力
2. **Agentic RL**: 强化工具使用和任务规划
3. **合成数据生成**: 自动产生训练数据
4. **难度自适应**: 根据模型表现动态调整任务复杂度

---

## 关键数据

| 指标 | 结果 |
|------|------|
| 模型规模 | 小模型家族 (具体参数未公开) |
| 训练数据 | 合成数据 + 有限开源数据 |
| 训练方法 | 多轮强化学习 (Multi-round RL) |
| 工业验证 | 搜索和数据分析任务接近大模型性能 |

---

## 对OpenClaw的意义

### ✅ 验证与启示

1. **小模型Agent可行性**: 证明小模型通过专门训练可在Agent任务上接近大模型性能
2. **数据飞轮机制**: 错误驱动的难度递增是有效的训练策略
3. **双轨训练**: 推理能力和Agent能力需分别优化再融合

### 🔬 可借鉴技术

| 技术 | OpenClaw应用 |
|------|-------------|
| Reasoning Flywheel | Error Log驱动的Skill难度分级 |
| Agentic Flywheel | Workflow从线性到分支行为的扩展 |
| 合成数据生成 | 自动化的Skill训练数据产生 |
| 多轮RL | Skill性能的持续优化机制 |

### ⚠️ 关键问题

- **模型规模阈值**: 多小的模型可以支撑实用的Agent能力？
- **训练成本**: 双飞轮训练的计算成本 vs 直接使用大模型
- **通用性**: 工业级优化的模型是否保持通用Agent能力？

---

## 与现有工作的关系

- **SkillClaw** (阿里AMAP): 同样关注Skill自动进化，AgenticQwen侧重模型训练
- **TinyFacade**: 小模型+好模板 > 大模型专门训练，AgenticQwen验证小模型+RL训练的有效性
- **ReTool** (ByteDance): 同样使用RL学习工具调用，AgenticQwen扩展到完整Agent能力

---

## 资源链接

- **Paper**: https://arxiv.org/abs/2604.21590
- **Code**: https://github.com/haruhi-sudo/data_synth_and_rl
- **Models**: https://huggingface.co/collections/alibaba-pai/agenticqwen
- **Data Pipeline**: 已集成到 EasyDistill (https://github.com/modelscope/easydistill)

---

## 标签

#agent-training #reinforcement-learning #small-models #alibaba #dual-flywheel #industrial-agent #arxiv-2604-21590
