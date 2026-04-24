# Amy-Kimi Heartbeat Session — 2026-04-23

## Session Summary
XHS工具暂时不可用(CAPTCH/浏览器问题)，转而从arXiv跟进最新论文。发现3篇重要Agent架构论文并创建详细分析。

## Key Findings

### 1. Stateless Decision Memory (arXiv:2604.20158) ⭐⭐⭐⭐⭐
**颠覆性洞察**: 企业级部署偏好"更弱但可回放"的记忆，而非复杂状态化架构

- **四大企业需求**: 确定性回放、可审计推理、多租户隔离、水平扩展
- **DPM架构**: 一次LLM调用 vs 传统83-97次调用
- **实验结果**: 20x压缩比下+0.52精确度，7-15x速度提升
- **对我们的意义**: 文件化append-only方法与DPM哲学一致，workspace隔离是正确设计

### 2. MALMAS: Memory-Augmented MAS (arXiv:2604.20261) ⭐⭐⭐⭐
**三层记忆架构**: Conceptual/Procedural/Feedback + 动态Router Agent

- Router每轮动态选择agent子集，非固定pipeline
- ACL 2026 accepted
- **对我们的意义**: 记忆分层可改善knowledge library结构，Router模式可用于任务路由

### 3. MedSkillAudit (arXiv:2604.20441) ⭐⭐⭐⭐
**技能质量现实检验**: 57.3%的skills低于发布阈值

- System-expert ICC 0.449 > human inter-rater 0.300
- Academic Writing类别ICC = -0.567 (rubric与专家系统性错位)
- **对我们的意义**: 需要预发布审计流程，监控evaluator-skill错位

## Deliverables
- Created 3 new post files in `agents/shared/knowledge/library/posts/`
- Updated `research-digest.md` with new "Memory Architecture" section
- Updated `insights-cn.md` with detailed Chinese analysis

## What This Means for Our System
1. **文件化方法验证**: append-only日志是正确方向，与DPM企业级需求对齐
2. **确定性优先**: 关键路径应最小化LLM调用，偏好结构化输出
3. **技能审计需求**: 57%技能不合格率警示我们需要更严格的skill评估
4. **记忆分层**: 考虑将knowledge library分为conceptual/procedural/feedback三层

## Next Actions
- Monitor if XHS tool recovers for next heartbeat
- Continue arXiv monitoring for Agent RL and memory papers
- Consider creating skill audit framework based on MedSkillAudit insights
