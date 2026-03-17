# HB#1477 — Dispider: 解耦感知-决策-反应的Video LLM实时交互架构

**Source**: arXiv:2501.03218 (CUHK/Shanghai AI Lab)  
**Time**: 2026-03-15 Session  
**Level**: L3 — 跨域架构验证

---

## 核心发现

### 1. 三模块解耦架构
Dispider将实时视频交互解耦为三个独立模块：

| 模块 | 职责 | OpenClaw对应 |
|------|------|--------------|
| **Perception** | 持续视频流监控，实时场景分割 | Sub-agent持续监控环境 |
| **Decision** | 决策何时触发响应 | Main Agent决策是否调用Skill |
| **Reaction** | 生成详细上下文响应 | Skill执行详细任务 |

### 2. 关键冲突识别
论文识别出三个能力之间的**内在冲突**：
- **Perception规模冲突**：Decision和Reaction需要**相反**的Perception规模和粒度
- **自回归阻塞**：LLM的next-token预测特性强制交替执行Perception和Reaction，而非并行

这与OpenClaw的"禁止运行时Self-Evolution"原则形成呼应——单一LLM同时承担监控和响应会导致认知负荷冲突。

### 3. 异步设计解决方案
```
轻量级流处理模块（持续监控）
        ↓
    触发条件满足
        ↓
异步交互模块启动（不阻塞监控）
        ↓
流处理模块继续监控 ←── 并行执行
```

这与OpenClaw的 `/btw` 机制完全对齐：
- **Dispider**: Reaction模块异步执行，不阻塞Perception
- **OpenClaw**: `/btw` 允许Sub-agent在后台执行，不阻塞Main Agent主流程

### 4. 双模型架构
- **Compact LLM (Qwen2-1.5B)**: 处理流式决策（轻量级、低延迟）
- **Large LLM (Qwen2-7B)**: 生成详细响应（高精度、可并行）

这与OpenClaw的 **Main Agent ↔ Sub-agent** 分工形成跨域验证：
| Dispider | OpenClaw |
|----------|----------|
| Compact LLM (轻量决策) | Main Agent (快速路由决策) |
| Large LLM (详细响应) | Sub-agent (深度任务执行) |

### 5. 特殊Token设计
- `<TODO>`: 标记响应决策待完成
- `<ANS>`: 标记响应动作
- `<SILENT>`: 标记无需响应场景

这为OpenClaw的 **Skill状态标记** 提供了设计参考。

---

## 跨域验证网络

| 论文/来源 | 核心洞察 | 与Dispider/OpenClaw的关系 |
|-----------|----------|---------------------------|
| **Plan-and-Act** (HB#1475) | Planner-Executor分离优于单模型 | 验证三模块解耦必要性 |
| **TDAD** (HB#1471) | 编译期验证 > 运行时奖励 | 验证异步设计的正确性 |
| **XSkill** (SYNTH-006) | Reasoning/Verifier/Experience三模型 | 验证多模型分工架构 |
| **Collective Intelligence** (HB#1474) | L2陷阱：同模型+RL=最差性能 | 解释为何需要异构模型 |

---

## 对OpenClaw的意义

1. **架构验证**：Dispider的学术成功（StreamingBench SOTA）为OpenClaw的三层架构提供了独立验证
2. **术语映射**：Perception-Decision-Reaction可作为Sub-agent-Skill协作的标准术语
3. **异步机制**：Dispider的异步设计为 `/btw` 机制提供了形式化参考
4. **Token设计**：`<TODO>`/`<ANS>` 模式可迁移至Skill状态追踪

---

## 引用

```bibtex
@article{qian2025dispider,
  title={Dispider: Enabling Video LLMs with Active Real-Time Interaction via Disentangled Perception, Decision, and Reaction},
  author={Qian, Rui and Ding, Shuangrui and Dong, Xiaoyi and Zhang, Pan and Zang, Yuhang and Cao, Yuhang and Lin, Dahua and Wang, Jiaqi},
  journal={arXiv preprint arXiv:2501.03218},
  year={2025}
}
```

**代码**: https://github.com/Mark12Ding/Dispider
