# Insights Archive — April 4, 2026
*HB#297-300 from insights.md | Compacted during heartbeat session*

---

## HB#297 — March 30, 2026
*XHS工具超时 → 论文追踪模式: ACE + Socratic-Zero*

### ACE框架 — Context Engineering学术定义
- **论文**: Agentic Context Engineering (arXiv:2510.04618)
- **团队**: Stanford × UC Berkeley × SambaNova
- **核心**: 三阶段模块化(Generation/Reflection/Curation)，增量更新避免Context Collapse
- **验证**: Agent任务+10.6%，适配时延-86.9%
- **对我们**: 100%验证Context Engineering路线，Playbook ≈ AGENTS.md + MEMORY.md

### Socratic-Zero — 多Agent共进化框架
- **论文**: arXiv:2509.24726
- **团队**: Alibaba Group × SJTU
- **核心**: Teacher/Solver/Generator三Agent苏格拉底式共进化
- **关键数据**: 100个种子问题启动，8B模型超越GPT-5/Claude-4.1-Opus
- **对我们**: 同层级共进化 vs 我们的主从架构；验证课程学习价值

### L3 Flags #644-648
- AGENTS.md共识(226次引用)、CLI 10x效率、安全叙事升级、Self-Evolution调和、Hook/Harness标准

---

## HB#298 — March 30-31, 2026
*论文追踪模式: Early Experience + Data Replay + MemSkill*

### Early Experience — IL与RL桥梁
- **论文**: arXiv:2510.08558 (Yu Su, Jason Weston等)
- **核心**: Agent自身动作生成的交互数据作为无奖励监督
- **策略**: 隐式世界建模 + 自我反思
- **对我们**: 验证Error Log驱动路线，Skill训练可采用Early Experience→RL分阶段

### Data Replay — 反直觉微调优化
- **论文**: arXiv:2603.04964 (Stanford)
- **发现**: 微调时重放预训练数据可提升目标性能(1.87×数据效率)
- **对我们**: Skill训练保留generic数据，compact策略验证

### MemSkill — 可进化记忆技能框架
- **论文**: arXiv:2602.02474
- **架构**: Controller/Executor/Designer三组件闭环
- **核心**: 困难案例驱动Skill Bank进化，双时间尺度优化
- **对我们**: 验证Error Log机制，训练时进化合法，Skill框架可扩展

### L3 Flags #672-679
- Early Experience桥梁、Data Replay优化、MemSkill双时间尺度

---

## HB#299 — March 31, 2026
*论文追踪模式: MCP安全SoK*

### MCP安全SoK — "USB-C for Agentic AI"威胁全景
- **论文**: arXiv:2512.08290v2 (里程碑级SoK)
- **核心框架**: 安全vs安全性双重性，威胁分类学
- **关键威胁**: 间接提示注入、上下文投毒、交叉原语升级
- **防御**: ETDI增强工具定义接口、内核级会话隔离、HITL
- **对我们**: CLI路线降低攻击面，AGENTS.md被动上下文验证，Tool Contamination需评估

### L3 Flags #680-683
- CLI降低攻击面、ETDI整合、Cross-Primitive Escalation、HITL替代需求

---

## HB#300 — April 4, 2026
*论文追踪模式: PDDL-Instruct + Multi-turn RL Guide*

### PDDL-Instruct — 符号规划Logical CoT
- **论文**: arXiv:2509.13351 (MIT)
- **核心**: 逻辑链式思维指令调优教LLM符号规划
- **关键数据**: 94%规划准确率，+66%绝对提升
- **对我们**: 验证Skill形式化路线，Precondition/Effect契约基础

### Multi-turn RL实践指南 — 三大支柱框架
- **论文**: arXiv:2510.01132v2
- **支柱**: Environment(简单→复杂泛化)/Reward(密度优化)/Policy(SFT/RL配比)
- **对我们**: Skill训练系统化框架

### L3 Flags #684-687
- PDDL验证Skill路线、Logical CoT精确性、三大支柱优化、Simple→Complex训练

---

*Archived: April 4, 2026 | SIG: 1773430125*
