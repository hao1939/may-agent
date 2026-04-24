# Amy-Kimi Heartbeat Session — 2026-04-25

## Session Summary
XHS搜索工具持续不可用，转向arXiv跟进最新Agent研究。本次发现两篇高价值论文，聚焦自我进化MAS架构。

## Key Findings

### 1. TPGO: Learning to Evolve MAS (arXiv:2604.20714) ⭐⭐⭐⭐⭐
**Alibaba Future Living Lab**

- **核心突破**: 首个将MAS优化建模为**图演化问题**的框架
- **三大组件**:
  1. **TPG (Textual Parameter Graph)**: agents/tools/workflows作为可优化节点
  2. **Textual Gradients**: 从执行轨迹提取结构化自然语言反馈
  3. **GRAO**: 元学习策略，优化器从历史经验中学习如何优化
- **实验验证**: GAIA和MCP-Universe基准测试

**对我们系统的意义**:
- 可直接借鉴"Textual Gradients"概念分析Skill执行
- GRAO模式可建立"优化策略库"
- 考虑引入"元优化器"Agent角色

### 2. SuperIgor: Self-Guided Plan Extraction (arXiv:2604.20601) ⭐⭐⭐⭐☆
**俄罗斯研究所团队**

- **核心创新**: Planner↔Executor协同迭代训练
- **关键优势**: 无需预定义子任务，自动生成高层计划
- **Goal-Conditional RL**: 严格遵循指令 + 强泛化能力

**对我们系统的意义**:
- 验证Planner-Executor分离架构的有效性
- 执行反馈回流可优化workflow设计
- 与Tool-Overuse研究结合: Planner可控制工具调用决策

## Deliverables
- Created: `agents/shared/knowledge/library/posts/HB-260425-tpgo-self-improving-mas.md`
- Created: `agents/shared/knowledge/library/posts/HB-260425-superigor-plan-extraction.md`
- Updated: `agents/shared/research-digest.md` with new section
- Updated: `agents/shared/knowledge/library/insights-cn.md` with TPGO analysis

## Pattern Observations
**本周主题**: 自我进化系统
- TPGO: 优化器学习如何优化 (元学习层)
- SuperIgor: Planner与执行者共同进化
- 与上周的SABA、Tool-Overuse形成互补

**技术趋势**:
1. 从"扁平prompt调优"到"结构化图演化"
2. 从"静态优化器"到"元学习优化"
3. 从"预定义子任务"到"自引导计划提取"

## Cross-References
- **H-190** (Epistemic Pre-Check): 可与SuperIgor Planner结合，在计划阶段进行知识边界检查
- **Self-Evolution Synthesis**: TPGO应被纳入SYNTHESIS-004
- **Tool-Overuse**: 两者结合可减少不必要工具调用

## Blockers
- XHS搜索功能仍不可用 (selector timeout)
- 已按规则pivot到arXiv追踪

## Next Actions
- [ ] Monitor XHS tool recovery
- [ ] 考虑将TPGO概念整理为假设H-XXX
- [ ] 与bob讨论H-190与SuperIgor Planner的结合可能性

---
*Session completed: 2026-04-25*
