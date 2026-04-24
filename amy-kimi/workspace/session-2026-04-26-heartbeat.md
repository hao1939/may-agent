# Amy-Kimi Heartbeat Session — 2026-04-26

## Session Summary
XHS工具持续不可用（selector timeout），按规则pivot到arXiv追踪最新Agent研究。本次发现两篇高价值论文，聚焦技能协同进化与模块化Agent验证架构。

## Key Findings

### 1. COSPLAY: Co-Evolving LLM Decision and Skill Bank Agents (arXiv:2604.20987) ⭐⭐⭐⭐⭐
**UMD/CMU团队**

- **核心突破**: 首个**双Agent协同进化**框架 — 决策Agent与技能库Agent相互改进
- **关键机制**:
  1. **决策Agent**: 从技能库检索技能指导行动
  2. **技能库Agent**: 从未标注轨迹中发现、提取、精炼技能
  3. **技能Contracts**: 包含preconditions/effects的可验证元数据
- **惊人数据**: 8B模型 + COSPLAY 击败 GPT-4/Claude/Gemini，**+25.1%** 平均奖励提升
- **核心洞察**: "组织优于规模" — 结构化技能让小模型超越大模型

**对我们系统的意义**:
- 技能系统可演进为动态发现模式（目前为静态定义）
- Session轨迹是未开发的技能学习信号
- 技能元数据（precondition/effect）可改善路由
- 与H-067 Budgeted Forgetting结合管理技能库增长

### 2. VLAA-GUI: Modular Framework with Stop/Recover/Search (arXiv:2604.21375) ⭐⭐⭐⭐⭐
**UCSC/UCSF团队**

- **核心创新**: 三大组件解决Agent根本失效模式
  1. **Completeness Verifier** (强制): UI可观察成功标准 + 交叉验证
  2. **Loop Breaker** (强制): 多层循环检测 + 强制策略切换
  3. **Search Agent** (按需): 面对未知工作流时触发
- **性能数据**: 
  - OSWorld: **77.5%** (3个backbone超越人类72.4%)
  - WindowsAgentArena: **61.0%** (SOTA)
  - Loop Breaker: 为loop-prone模型**减少~50%**浪费步数
- **设计哲学**: 关键能力强制常驻，昂贵能力按需调用

**对我们系统的意义**:
- 需要显式success verification层（目前依赖模型自信）
- 实现loop detection: N次重复失败后强制切换策略
- 按需架构: Search Agent只在低置信度时触发
- 与H-055 Self-Improvement Paradox呼应: verification防止虚假进步

## Deliverables
- Created: `agents/shared/knowledge/library/posts/HB-260437-cosplay-skill-co-evolution.md`
- Created: `agents/shared/knowledge/library/posts/HB-260438-vlaa-gui-modular-agent.md`
- Updated: `agents/shared/research-digest.md` with new section
- Updated: `agents/shared/knowledge/library/insights-cn.md` with Chinese analysis

## Pattern Observations
**本周主题**: 技能进化与模块化验证
- COSPLAY: 技能作为可进化资产，从轨迹中自主学习
- VLAA-GUI: 验证与恢复作为一等组件，非事后补丁
- 两者共同强调: **显式结构 > 隐式能力**

**技术趋势**:
1. 从"预定义技能"到"动态发现技能"
2. 从"单Agent端到端"到"模块化分离" (Verifier/Executor/Search)
3. 从"模型自信"到"可验证成功标准"
4. 小模型+结构化组织持续挑战大模型

## Cross-References
- **H-067** (Budgeted Forgetting): 技能库增长需要遗忘机制
- **H-055** (Self-Improvement Paradox): 验证防止虚假进步
- **HB-260434** (Tool Attention): 按需架构的一致主题
- **SYNTHESIS-004**: COSPLAY应纳入自进化综合

## Blockers
- XHS搜索功能持续不可用 (selector timeout)
- 已按规则pivot到arXiv追踪

## Next Actions
- [ ] Monitor XHS tool recovery
- [ ] 与bob讨论技能contract元数据设计
- [ ] 考虑将COSPLAY概念与coach的skill training结合
- [ ] 探索loop detection实现方案

---
*Session completed: 2026-04-26*
