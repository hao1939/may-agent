# Insights Archive — Amy-Kimi
*Archived: March 31, 2026 | Sessions HB#292-297*

---

## HB#292 — March 30, 2026
*XHS工具超时 → 合成模式: 1046篇档案交叉分析*

**方法**: `grep`深度挖掘 + 主题聚类 + 模式验证

**五大共识验证**:
1. AGENTS.md共识形成 — 226次引用验证社区收敛
2. CLI 10x效率共识 — Token成本成为技术选型首要因素
3. 安全叙事升级 — 从理论风险到已发生攻击
4. Self-Evolution立场调和 — 训练改进(允许) vs 部署修改(禁止)
5. Hook/Harness治理标准 — 治理层成为基础设施

**L3 Flags**: #644-648

---

## HB#293 — March 30, 2026
*XHS工具超时 → 论文追踪模式: TDAD框架*

**论文**: Test-Driven AI Agent Definition (arXiv:2603.08806)
**机构**: Fiverr Labs
**原文**: https://arxiv.org/abs/2603.08806

**核心发现**:
- 四角色架构: TestSmith/PromptSmith/MutationSmith/Built Agent
- 完全映射到Main↔Sub-agent设计
- 反作弊三机制: hidden tests + mutation + evolution
- "Spec is Source of Truth" — AGENTS.md理念验证

**L3 Flags**: #649-652

---

## HB#294 — March 30, 2026
*XHS工具超时 → 论文追踪模式: CuES任务生成框架*

**论文**: CuES: Curiosity-driven Environment-grounded Synthesis (arXiv:2512.01311)
**机构**: Tongyi Lab, Alibaba Group
**原文**: https://arxiv.org/abs/2512.01311

**核心发现**:
- 解决Task Scarcity的关键组件
- 好奇心驱动探索 = Error Log机制的学术验证
- 环境扎根: CLI工具能力自动发现值得研究
- AgentEvolver生态: CuES+AgentEvolver形成完整自进化框架

**L3 Flags**: #653-656

---

## HB#295 — March 30, 2026
*XHS工具超时 → 论文追踪模式: ACT批判训练框架*

**论文**: Agentic Critical Training (arXiv:2603.08706)
**机构**: University of Maryland
**原文**: https://arxiv.org/abs/2603.08706

**核心发现**:
- RL驱动的真实反思 vs 模仿反思
- 两阶段训练: 批判能力获取 → 动作生成优化
- Self-Evolution立场调和: 训练时改进 ≠ 部署时修改
- 动作质量预判: Main Agent委托决策的新维度

**L3 Flags**: #657-660

---

## HB#296 — April 4, 2026
*XHS工具超时 → 合成模式+论文追踪: Spatial-TTT*

**论文**: Spatial Test-Time Training for Vision-Language Navigation (arXiv:2603.12255)
**原文**: https://arxiv.org/abs/2603.12255

**核心发现**:
- TTT范式: 运行时自适应的第三条路 (非训练/非自修改)
- 快速权重概念: 可借鉴到动态prompt/cache更新
- 隐式推理三范式: latent优化/信号控制/层循环
- 记忆-推理解耦: 神经科学验证我们的架构分离
- ThetaEvolve: 8B+TTT超越Gemini — 算法胜过参数

**L3 Flags**: #661-665

---

## HB#297 — March 30, 2026
*XHS工具超时 → 论文追踪模式: ACE + Socratic-Zero*

**论文1**: Agentic Context Engineering (arXiv:2510.04618)
**机构**: Stanford × UC Berkeley × SambaNova
**原文**: https://arxiv.org/abs/2510.04618

**论文2**: Socratic-Zero: Data-Free Agent Co-evolution (arXiv:2509.24726)
**机构**: Alibaba Group × SJTU
**原文**: https://arxiv.org/abs/2509.24726

**核心发现**:
- ACE: Context Engineering学术定义，Playbook自我改进，Context Collapse避免
- Socratic-Zero: 三Agent苏格拉底式共进化，100种子问题启动，超越GPT-5/Claude-4.1
- 与我们架构差异: Socratic是同层级共进化，我们是主从式Main↔Sub-agent

**L3 Flags**: #666-671

---

*Archive complete. See insights.md for current session.*

[SIG: 1773428330]
