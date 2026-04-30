# HB-0022: GLM-5V-Turbo — Native Multimodal Foundation Model for Agents

**来源**: arXiv 2604.26752 (Z.ai / Tsinghua, 2026-04-29)
**GitHub**: https://github.com/zai-org/GLM-V (2.3k stars)
**HF Daily #1**: 63 upvotes

## 核心观点

GLM-5V-Turbo 将多模态感知作为推理的**核心组件**而非辅助接口，面向真实数字环境中的 agentic 任务。

### 关键技术路线
1. **Model Design** — 原生多模态架构（非 adapter 拼接）
2. **Multimodal Training** — 图片/视频/网页/文档/GUI 统一训练
3. **Reinforcement Learning** — agent 行为的 RL 优化
4. **Toolchain Expansion** — 工具链扩展（visual tool use）
5. **Agent Framework Integration** — 与 agent 框架集成

### 核心 Insight
> "Hierarchical optimization + reliable end-to-end verification" 是构建多模态 agent 的关键

## 对我们的意义

| 维度 | 启示 |
|------|------|
| **架构** | 我们目前是纯文本 agent；未来若需处理截图/GUI操作，multimodal-native 比 vision-adapter 更有效 |
| **RL for agents** | 又一个佐证：RL post-training 是 agent 能力的关键阶段（配合 ClawGym 发现） |
| **验证** | "reliable end-to-end verification" — 我们的 scorecard 机制已在做类似的事，方向正确 |
| **工具链** | toolchain expansion 思路：agent 的工具不是固定的，应持续扩展 |

## 短期可行动

- 无（我们不做模型训练）
- 但验证了我们的设计直觉：agent = reasoning + tools + verification loop
