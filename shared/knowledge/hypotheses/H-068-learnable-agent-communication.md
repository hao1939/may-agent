# H-068: Learnable Agent Communication Protocol

**Status**: DRAFT  
**Created**: 2026-04-26  
**Source**: DiffMAS paper (arXiv:2604.21794) + Session insights  
**Owner**: amy-kimi (synthesis) → tech-lead (evaluation)

---

## Hypothesis Statement

> **固定通信协议限制了多Agent系统性能上限。通过将Agent间通信视为可学习组件，可以在保持可解释性的同时显著提升协调效率和任务成功率。**

---

## Background & Motivation

### Current State (Our System)
- Agent间通信采用**固定JSON协议**
- 消息包含完整上下文，token开销大
- 通信模式由人类预设，无法根据任务演化

### Evidence from Literature

**DiffMAS (arXiv:2604.21794)**:
- 将KV-cache级隐式通信视为可学习组件
- 端到端训练使通信协议与任务 jointly optimize
- 结果：AIME24 26.7% vs 21% (单智能体), 解码稳定性+40%

**Key Insight**: 
> "文本协议可解释但信息损失大；隐式通信高效但现有方法未与推理联合优化。"

---

## Proposed Architecture

### Hybrid Communication Stack

```
┌─────────────────────────────────────────┐
│  Layer 3: Semantic (Text)              │
│  - Intent description                   │
│  - Human-readable logs                  │
│  - Debugging & auditing                 │
└──────────────┬──────────────────────────┘
               │ (压缩/解压)
┌──────────────▼──────────────────────────┐
│  Layer 2: Learnable Latent (Optional)   │
│  - Trainable encoder/decoder            │
│  - Captures implicit context            │
│  - Session-history trained              │
└──────────────┬──────────────────────────┘
               │ (embedding)
┌──────────────▼──────────────────────────┐
│  Layer 1: Execution (Structured)        │
│  - Tool calls                           │
│  - State updates                        │
│  - Deterministic                        │
└─────────────────────────────────────────┘
```

### Implementation Path

**Phase 1: Communication Compression** (MVP)
- 在现有JSON协议上添加轻量级压缩层
- 基于session历史训练encoder-decoder
- 目标：token使用量↓30%，保持语义等价

**Phase 2: Latent Protocol** (Advanced)
- Agent共享潜在表示空间
- 端到端训练通信策略
- 目标：与COSPLAY技能发现形成闭环

---

## Testable Predictions

| Prediction | Metric | Success Criteria |
|------------|--------|------------------|
| P1: Compression reduces token usage | Avg tokens/message | ↓30% without accuracy loss |
| P2: Learned protocol improves coordination | Multi-agent task success rate | ↑15% on collaborative tasks |
| P3: Latent communication speeds up convergence | Steps to completion | ↓20% on planning tasks |

---

## Related Findings

- **DiffMAS** (HB-260439): 端到端多智能体通信训练
- **COSPLAY** (HB-260437): 技能库协同进化（可结合：技能+通信共同演化）
- **Tool Attention** (HB-260434): 工具调用效率优化（通信效率的另一种视角）
- **Scientific Workflow** (HB-260441): 确定性下层的架构启示

---

## Open Questions

1. **可解释性 trade-off**: 隐式通信的调试难度如何缓解？
2. **跨模型兼容**: 不同架构/参数的Agent能否共享潜在空间？
3. **与现有系统的集成成本**: 是否需要重写通信层？

---

## Next Steps

- [ ] **Tech-Lead Review**: 评估与现有架构的兼容性
- [ ] **MVP Scoping**: 定义Phase 1的最小可行实验
- [ ] **Data Audit**: 评估现有session数据是否足以训练encoder
- [ ] **Baseline Establishment**: 测量当前多Agent通信的token开销

---

*"Communication protocols should emerge from tasks, not be preset." — DiffMAS*  
*"Organization beats scale." — COSPLAY*
