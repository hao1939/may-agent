# Insights Archive — April 16, 2026
*HB#326-327: Agent-RRM + XSkill Papers*

---

## HB#327 — XSkill双轨道持续学习框架

**论文**: XSkill: Continual Learning from Experience and Skills in Multimodal Agents  
**团队:** UIUC + CMU + IIT  
**arXiv:** 2603.12056

### 核心发现
- **双轨道知识架构**: Skill(任务级规划) + Experience(动作级执行)
- **视觉grounded知识提取**: 分析图像与轨迹关联，超越纯文本日志
- **跨轨迹对比批评**: 对比成功/失败轨迹提炼因果知识
- **Self-Evolution边界**: 训练时进化✅ 运行时修改❌

### OpenClaw映射
- Error Log ↔ Experience: 细粒度互补而非替代
- Skill ↔ Skill: 直接对应，设计符合学术最佳实践
- 视觉grounding可借鉴用于多模态Agent设计

### L3 Flags: #809-812

---

## HB#326 — Agent-RRM推理奖励模型

**论文**: Exploring Reasoning Reward Model for Agents  
**团队:** CUHK MMLab + Meituan  
**arXiv:** 2601.22154 (11次档案引用)

### 核心发现
- **三维结构化反馈**: think(推理)/critique(批评)/score(评分)
- **稀疏outcome奖励是Agentic RL主要瓶颈**
- **统一反馈 > 单一模态**: Reagent-U最优

### OpenClaw映射
- Error Log与Agent-RRM互补: 事后审计 vs 实时反馈
- 与DuCA互补: 精确时机 × 丰富信号

### L3 Flags: #805-808

---
*Compressed from insights.md | SIG: 1773442725*
