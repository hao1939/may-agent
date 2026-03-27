# Paper Archive: HomeSafe-Bench

**Source:** arXiv:2603.11975v1  
**Date:** March 12, 2026  
**Category:** L1 — Foundational Safety Research  

---

## Paper Metadata

| Field | Value |
|-------|-------|
| **Title** | HomeSafe-Bench: Evaluating Vision-Language Models on Unsafe Action Detection for Embodied Agents in Household Scenarios |
| **Authors** | Jiayue Pu, Zhongxiang Sun, Zilu Zhang, Xiao Zhang, Jun Xu |
| **arXiv** | 2603.11975 |
| **Institution** | Not specified |
| **Subjects** | cs.CV, cs.AI, cs.CR |

---

## Core Contributions

### 1. HomeSafe-Bench: 家庭场景安全评估基准

**问题识别**: 与结构化工业环境不同，家庭空间引入不可预测的安全风险，系统限制（感知延迟、常识知识缺失）可能导致危险错误。

**现有评估局限**:
- 局限于静态图像
- 局限于文本描述
- 局限于一般性危险识别
- **缺乏动态不安全动作检测能力**

**基准特征**:
| 属性 | 规格 |
|------|------|
| 案例数量 | 438个多样化案例 |
| 功能区域 | 6个家庭功能区 |
| 标注维度 | 细粒度多维标注 |
| 构建方法 | 物理仿真 + 视频生成混合流水线 |

### 2. HD-Guard: 层级双脑安全守卫

**架构设计**:
```
┌─────────────────────────────────────────┐
│           HD-Guard Architecture         │
├─────────────────────────────────────────┤
│  ┌──────────┐      ┌──────────────┐    │
│  │ FastBrain│←────→│   SlowBrain  │    │
│  │ (轻量级)  │      │ (大规模VLM)   │    │
│  └────┬─────┘      └──────┬───────┘    │
│       │                   │            │
│   高频筛查            深度推理          │
│   连续运行            异步触发          │
│   低延迟              高准确度          │
└─────────────────────────────────────────┘
```

**组件对比**:
| 组件 | FastBrain | SlowBrain |
|------|-----------|-----------|
| **功能** | 连续高频筛查 | 深度多模态推理 |
| **模型规模** | 轻量级 | 大规模VLM |
| **运行模式** | 同步连续 | 异步触发 |
| **优化目标** | 推理效率 | 检测准确度 |
| **触发条件** | 始终运行 | 语义边界附近 |

**核心洞察**: 在句子内部（及短语义连贯跨度内），主导注意力支持往往保持稳定 → 支持快慢分离架构。

---

## 与LABSHIELD的互补性

| 维度 | LABSHIELD | HomeSafe-Bench |
|------|-----------|----------------|
| **场景** | 科学实验室 | 家庭环境 |
| **危险类型** | 化学/物理/生物 | 日常家庭风险 |
| **评估焦点** | PRP三支柱 | 动态动作检测 |
| **干预架构** | 四级分类法 | 双脑层级架构 |
| **检测方式** | 静态+推理 | 流式视频分析 |

**共同主题**: 两者都认识到**纯语言对齐≠具身安全**，都需要多模态感知与推理的结合。

---

## 技术亮点

### 慢快分离的决策架构

HD-Guard的FastBrain/SlowBrain设计与以下概念形成呼应:
- **Dual Process Theory** (Kahneman): System 1 vs System 2
- **SLEEC Norms**: Runtime Guardrails的分层实现
- **Error Log**: 高频本地检查 + 深度异步分析

### 流式安全监控

```
视频流 → FastBrain持续筛查 → 异常检测 → 触发SlowBrain
                ↓
            正常继续
```

---

## L3 FLAGS — HomeSafe-Bench

```
┌─────────────────────────────────────────────────────────────────────┐
│ L3 FLAGS — HomeSafe-Bench Paper                                     │
├─────────────────────────────────────────────────────────────────────┤
│ #881 [Safety] HD-Guard双脑架构 → Error Log分层验证的设计参考          │
│       FastBrain(高频轻量) ↔ SlowBrain(深度异步)                      │
│                                                                     │
│ #882 [Safety] 家庭场景安全评估 → Skill场景扩展： beyond实验室        │
│       HomeSafe-Bench补充LABSHIELD的场景覆盖缺口                      │
│                                                                     │
│ #883 [Architecture] 流式安全监控 → Channel实时检查需求               │
│       视频流处理能力与当前文本中心的Channel架构差距                   │
│                                                                     │
│ #884 [Gap] 动态动作检测 → 当前Error Log静态检查之外的新需求          │
│       需要时序推理能力，不仅是单点验证                               │
│                                                                     │
│ #885 [Insight] 注意力稳定性 → Slow-Fast Inference理论支撑            │
│       与arXiv:2603.12038的SFI形成技术共鸣                            │
└─────────────────────────────────────────────────────────────────────┘
```

---

## 对我们意味着什么

### 与OpenClaw的关联

| 论文概念 | OpenClaw映射 | 意义 |
|----------|-------------|------|
| FastBrain | Error Log本地检查 | 验证现有设计的合理性 |
| SlowBrain | Sub-agent审计 | 异步深度分析的架构支持 |
| 流式处理 | Channel扩展 | 未来多模态能力的预演 |
| 动态检测 | 运行时监控 | 超越静态代码检查的新维度 |

### 研究议程更新

1. **场景扩展**: 从实验室安全延伸到家庭/办公场景
2. **架构参考**: HD-Guard的双脑设计可作为Error Log演进参考
3. **能力缺口**: 当前系统缺乏时序推理和流式处理能力
4. **评估借鉴**: HomeSafe-Bench的混合构建方法(仿真+生成)值得参考

---

## References

- arXiv: https://arxiv.org/abs/2603.11975
- GitHub: https://github.com/pujiayue/HomeSafe-Bench
- Project Page: https://pujiayue.github.io/homesafe-bench.github.io/

---

**Relevant to:** bob (safety architecture), tech-lead (runtime monitoring), scout (multi-modal safety)

**Related Papers:**
- LABSHIELD (arXiv:2603.11987) — 实验室场景互补
- Slow-Fast Inference (arXiv:2603.12038) — 技术理论基础
- SLEEC Norms (arXiv:2603.11864) — 规范操作化框架
