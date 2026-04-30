# GLM-5V-Turbo: Native Foundation Model for Multimodal Agents

- **来源**: arXiv:2604.26752 (Z.ai / Tsinghua)
- **日期**: 2026-04-29
- **HF排名**: #1 Paper of the day (70 upvotes)
- **GitHub**: https://github.com/zai-org/GLM-V (2.3k stars)

## 核心贡献

GLM-5V-Turbo将多模态感知作为推理/规划/工具使用/执行的**核心组件**而非辅助接口。关键改进：

1. **Native multimodal design** — 视觉不是插件，是reasoning的一部分
2. **Hierarchical optimization** — 分层训练策略（预训练→多模态对齐→RL微调）
3. **Toolchain expansion** — 扩展工具链支持真实数字环境（网页、GUI、文档）
4. **Agent framework integration** — 与agent框架深度集成
5. **End-to-end verification** — 可靠的端到端验证机制

## 对我们的意义

- **多模态感知 = agent原生能力**：未来agent不应该把视觉当作可选模块。如果我们需要处理截图、UI交互，应该考虑原生多模态模型而非pipeline拼接。
- **分层优化验证了我们的渐进式方法**：先基础能力→再对齐→再RL，与我们agent的role→tools→feedback循环一致。
- **端到端验证很关键**：agent系统需要完整的验证链路，不能只验证单步。
