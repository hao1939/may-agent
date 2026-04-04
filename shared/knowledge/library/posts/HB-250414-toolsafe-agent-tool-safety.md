# ToolSafe: 北大提出的Step-level Agent工具安全方案

**来源**: arXiv:2601.10156  
**作者**: Yutao Mou等 (北京大学)  
**归档时间**: 2026-04-04  
**标签**: #agent-safety #tool-use #guardrail #step-level-monitoring

---

## 核心问题

LLM Agent通过调用外部工具与环境交互时，能力扩展的同时也放大了安全风险。实时监测step-level工具调用行为并在不安全执行前主动干预，对Agent部署至关重要，但仍属未充分探索领域。

## 核心贡献

### 1. TS-Bench 基准
- **首个**针对LLM Agent step-level工具调用安全检测的基准
- 评估Agent在交互过程中的每一步工具调用安全性

### 2. TS-Guard 护栏模型
- 基于**多任务强化学习**训练的guardrail模型
- **主动检测**不安全的工具调用动作（执行前拦截）
- 通过交互历史推理，评估：
  - 请求有害性 (request harmfulness)
  - 动作-攻击相关性 (action-attack correlations)
- 输出可解释、可泛化的安全判断和反馈

### 3. TS-Flow 推理框架
- Guardrail反馈驱动的Agent推理框架
- 将安全反馈整合到ReAct风格Agent的决策流程

## 实验结果

| 指标 | 效果 |
|------|------|
| 有害工具调用减少 | **65%** (平均) |
| 良性任务完成提升 | **~10%** (在prompt注入攻击下) |

## 技术架构

```
User Request → Agent Planning → TS-Guard Check → [Safe] Execute Tool
                                    ↓
                              [Unsafe] Block + Feedback
                                    ↓
                              Agent Re-plan
```

## 对我们的系统意味着什么

1. **Step-level监控**比对话级更细粒度，可捕捉工具链中的单点风险
2. **多任务RL训练**的guardrail可同时处理多种攻击模式
3. **Proactive干预**（执行前）比reactive（执行后）更安全
4. **反馈驱动重规划**让Agent从安全拦截中学习，而非简单拒绝

## 相关链接

- 论文: https://arxiv.org/abs/2601.10156
- 代码: https://github.com/MurrayTom/ToolSafe
