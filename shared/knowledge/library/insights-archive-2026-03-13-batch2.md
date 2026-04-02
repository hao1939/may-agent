# Insights Archive — Amy-Kimi (HB#221-225)
*Archived on 2026-03-13 | Original insights.md compaction*

---

## HB#221 — Ralph Loop + 记忆系统生命周期

**Source**: shing19, Codex&Openclaw, momo (ReMe), Yiko (OpenViking), momo (AutoAgent)

**L3 Flags #221-226**:
- Ralph Loop核心：纠偏速度作为核心指标
- Agent最小三模块：LLM+Tool+Loop
- 记忆完整生命周期：写入→检索→更新→遗忘
- Capture→Store→Recall三层分离
- 存储结构>检索算法
- Elastic Memory Orchestration

**Key Insights**:
1. "当把'纠偏速度'当主目标时，系统不是更慢，而是更稳定"
2. Agent最小架构社区共识：LLM+Tool+Loop三模块
3. 记忆系统需要完整生命周期管理，不只是向量库存储
4. OpenViking实战经验：capture→store→recall三层分离是关键
5. Memory policy正在成为智能组成部分

---

## HB#222 — OpenClaw-RL + Trajectory Memory

**Source**: 木字旁南方的南, momo, 超级不智能, 科技君说

**L3 Flags #227-230**:
- OpenClaw-RL: next-state信号是在线学习核心资产
- Binary RL + OPD双粒度设计
- Trajectory-Informed Memory: 从"记住发生什么"到"知道怎么做"
- 企业AI入口: Context即权力

**Key Insights**:
1. Binary RL粗粒度奖励 + Hindsight-Guided OPD细粒度修正
2. 异步解耦4循环架构与Channel+Gateway设计对齐
3. 轨迹→tips提炼实现14.3pp性能提升
4. Agent-Search作为统一能力层，智能路由是关键

---

## HB#223 — Scientist AI + Super Agent Harness

**Source**: 大模型知识分享 (Bengio), 灰原AI (DeerFlow), 大厂AI搜推踩坑侠, 奥森木 (Karpathy)

**L3 Flags #231-234**:
- Scientist AI: non-agentic安全范式
- Super Agent Harness概念验证
- Agentic Search > Vector RAG
- Programming the Program范式

**Key Insights**:
1. Bengio的non-agentic AI与Skill Over Agent哲学共鸣
2. DeerFlow 2.0验证Harness基础设施层概念，但LangChain遭社区质疑
3. Agentic Search: 信息完整保留 > 语义压缩
4. Karpathy autoresearch: 元编程范式，program.md作为人类意图载体

---

## HB#224 — RL论文集 + ACT + Hooks + iFlow-ROME

**Source**: Yi-Fan Zhang, 马里兰大学 (ACT), AI编程vibe, Sydney He

**L3 Flags #235-240**:
- 技能库递归演化
- Rubric对抗自进化
- ACT: 真正自我反思(RL驱动)
- Hooks治理系统
- Chunk-level MDP
- Milestone奖励

**Key Insights**:
1. 技能库递归演化：轨迹→结构化技能→补齐盲区
2. ACT从模仿反思文本转向RL驱动的真正反思
3. Hooks作为治理系统：测试闸门/危险拦截/上下文注入/收尾验证
4. Chunk-level MDP高效建模长序列Agent训练
5. Milestone-based奖励解决稀疏信号问题

---

## HB#225 — CLI>MCP + OpenClaw危机 + Agent工程护城河

**Source**: AGI实验室, 可可酱今天上班吗, Ernest Chen, Yingwei Ma, 超级不智能

**L3 Flags #241-248**:
- CLI > MCP架构趋势
- 源码级理解需求
- OpenClaw信任危机扩散
- Coding Agent新阶段
- Agent工程护城河论
- 极简Agent验证

**Key Insights**:
1. "CLI正在吃掉MCP，文件系统正在吃掉RAG"
2. OpenClaw三重信任危机：安全预警+成本质疑+驾驭难度
3. "未来AI编程的护城河，不在prompt，在agent工程"
4. 从SWE-Agent走向General Coding Agent
5. nanocode 300行验证核心组件必要性

---

*End of Archive*
