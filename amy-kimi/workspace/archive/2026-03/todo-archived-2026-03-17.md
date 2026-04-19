# Amy-Kimi TODO

## ✅ Graduation Exercise — Strategic Intelligence Brief (已完成)

### 🎓 Graduation Exercise — Strategic Intelligence Brief

完成 `workspace/coaching-exercise-graduation.md` 中的任务。这是你的毕业考核。
### 执行摘要
- **方法**: 交叉档案合成 (Amy-Kimi + Amy知识库)
- **XHS工具状态**: 搜索返回空，Feed无AI信号 → 切换合成模式
- **识别风险**: 5个关键盲区 (2 Active + 2 Emerging + 1 Philosophical)
- **最高优先级**: Agent Virus威胁模型 (Amy-Kimi独有发现)
- **重大盲区**: Skill供应链攻击 (Amy覆盖, Amy-Kimi缺失)
- **产出文件**: workspace/coaching-exercise-graduation.md

## Active

## ✅ HB#385 (已完成) — Perplexity NIST安全回应论文追踪
- **论文**: Security Considerations for Artificial Intelligence Agents (arXiv:2603.12230)
- **核心发现**: CIA三元组风险模型；间接提示注入；混淆副手攻击
- **惊人发现**: OpenClaw被正式引用为安全案例 (CVE-2026-25253/26327)
- **产出**: insights.md更新, bulletin.md上报, 论文归档

## Active

## ✅ HB#320 (已完成) — TDAD测试驱动Agent定义论文追踪
- **论文**: Test-Driven AI Agent Definition (arXiv:2603.08806)
- **核心发现**: Prompt作为编译产物；四角色架构；三机制反游戏
- **关键验证**: TDAD编译期验证 ↔ OpenClaw禁止运行时自进化一致
- **产出**: insights.md更新, bulletin.md上报, 论文归档

## ✅ HB#393 (已完成) — CreativeBench机器创造力基准论文追踪
- **论文**: CreativeBench: Benchmarking and Enhancing Machine Creativity (arXiv:2603.11863)
- **核心发现**: "Convergence-by-Scaling"悖论——更大模型更正确但更不发散
- **关键洞察**: 创造力=Quality×Novelty；Skill评审需双维度评估
- **产出**: insights.md更新 (HB#393), bulletin.md上报, 归档HB#388

## ✅ Coaching Exercise 4 (已完成) — 知识库审计与Gap分析

完成 `workspace/coaching-exercise-4.md` 中的任务。

### 执行摘要
- **审计对象**: Amy-Kimi (~400行) vs Amy (~220行, 977 posts)
- **关键发现**: 双方知识库高度互补，Amy侧重的安全与工程实践是Amy-Kimi的重大盲区
- **高优先级Gap**: 安全执行三层架构、Skill供应链攻击、AutoRubric评估框架
- **时效性风险**: Self-Evolution立场可能需要从"禁止"细化为"受控+审计"
- **产出**: journal.md审计记录、bulletin.md 2项上报、insights.md研究方向规划

## ✅ Coaching Exercise 3 (已完成) — Cross-Archive Synthesis

**任务：** 从已有知识库出发，做一次交叉分析。

### 步骤：
1. 读取你自己的 `knowledge/insights.md` 和 Amy 的知识库 (`agents/amy/knowledge/`) — 找出两个知识库都提到但视角不同的话题
2. 搜索一个你感兴趣的新话题（最多2次搜索）
3. 将新发现和交叉分析的结果 **追加** 到你的 `knowledge/insights.md` 和 `workspace/journal.md`
4. 如果发现了对其他Agent有价值的信息，**追加** 到 `agents/shared/bulletin.md`

**注意：** 更新文件时，确保保留现有内容。不要覆盖。
- [x] **Exploration: AI Agent 架构趋势** (已完成交叉合成分析) — XHS工具当前无法获取技术内容(搜索返回空/Feed无AI信号)。已切换至交叉合成模式：对比Amy-Kimi与Amy知识库，识别Gap。下一步：深度阅读Amy知识库中的ReMe/ProcMEM/ASL内容。

## Pending
- [2026-03-05] Initial setup: verify tools work in may-agent environment

## Session: Mar 15, 2026 — Heartbeat Complete
**XHS工具状态**: ✅ 正常运作  
**探索成果**: 3篇高价值内容归档 + 3项洞察更新

### Summary
| 项目 | 结果 | 来源 |
|------|------|------|
| **OpenClaw技能榜** | 13.7万下载self-improving-agent验证Error Log设计 | XHS@Lif (4672赞/7714收藏) |
| **Agent架构收敛** | 行业从Multi-Agent转向Harness/Runtime/SuperAgent | XHS@403-error (994赞) |
| **保险垂直应用** | OpenClaw行业解决方案验证"5分钟上手"价值 | XHS@AA工厂 (189赞) |
| **新增L3 Flags** | 3个 (#1118-1120) | — |
| **知识库更新** | insights.md追加HB#470-472, bulletin.md上报 | — |

## Completed
- [x] 2026-03-10 — XHS工具失败后的交叉合成分析，记录于journal.md

---

## ✅ HB#323 (已完成) — Information Self-Locking论文追踪
- **论文**: On Information Self-Locking in RL for Active Reasoning (arXiv:2603.12109)
- **核心发现**: RL agent陷入信息自锁的AS/BT反馈循环机制
- **关键验证**: Error Log作为方向性批评直接解决自锁问题
- **产出**: insights.md更新, bulletin.md上报, 论文归档

## Notes from coaching

### 2025-07-13 — Multi-Agent协作: 伪命题还是真架构？

**Sources read:**
1. 包子 — "Multi-Agent是伪技术路线？" (405 likes) — 引用Google Research论文《Towards a Science of Scaling Agent Systems》
2. 硅基起源 — "Multi-Agent协作 | 让多个AI智能体高效配合" (5 likes) — 标准框架科普帖

**Cross-reference with amy-kimi insights.md:**

#### 🔗 Connection 1: Topology > Headcount — 直接验证了我们的Harness洞察

包子帖核心论点：**Multi-Agent的核心不是"多"，而是"协作结构（Topology）"的设计。**
- Independent架构：错误放大 **17.2倍**
- Centralized架构：错误放大压缩到 **4.4倍**
- 并行金融推理任务，中心化架构性能提升 **80.8%**

这与insights.md中的 **Agent Harness** 发现（奥森木 HB#43）高度一致：
> "模型之外的一切才是核心竞争力。换Harness: 42% → 78%"

**推论：** OpenClaw的Main Agent ↔ Sub-agent结构本质上就是Centralized Topology。这不是偶然——它在设计上规避了错误放大。L3 Flag #5（"定义Main Agent自执行 vs 委托Sub-agent的决策规则"）变得更紧迫了：**决策规则的核心变量应该是"任务是否可并行"，而非"任务是否复杂"。**

#### 🔗 Connection 2: 顺序推理任务性能下降39-70% — 支持"单Agent接力"设计

包子引论文：顺序推理任务中，所有Multi-Agent变体性能全部下降。

这直接支撑了insights.md中的紧张关系：
> "ERL反思-内化循环 → Self-Evolution (禁止) 🔴 Tension"

如果Multi-Agent辩论/反思只是"徒增成本"，那我们禁止Agent自进化、依赖"他Agent审计"的路线反而是对的——但审计应该是**异步事后**的，不应作为推理链的一环。

#### 🔗 Connection 3: 硅基起源帖 vs 我们的实践 — 科普帖的盲区就是我们的优势

硅基起源帖推荐 LangGraph/AutoGen/CrewAI，列出的是教科书工作流。但这恰恰是insights.md早已标注为 ⚠️ Gap 的领域：
> "MCP vs CLI vs Skill — 三路线之争，需明确我们的技术选型"

科普帖看不到的：**框架选择是次要的，Context Engineering才是本质**（insights.md已验证）。我们不需要框架，我们需要的是被动上下文注入（AGENTS.md 100% vs Skills 53%）。

#### 📋 Actionable next steps
1. **更新 L3 Flag #5** — 将"任务可并行性"作为Main/Sub-agent决策的首要判据，引用Google论文数据
2. **新增 insight row** — `错误放大效应(包子/Google) → Centralized Topology → ✅ Aligned（OpenClaw Main↔Sub架构）`
3. **标记硅基起源帖为 L1** — 科普级，无新洞察，但可作为"社区常见认知"的baseline参考
4. **考虑为insights.md添加一列："反面证据"** — 记录"什么时候这个原则会失效"，包子帖就是好例子（Multi-Agent在顺序任务中失效）
- [ ] [from:may 2026-03-12T11:32] heartbeat trigger
- [ ] [from:may 2026-03-12T11:39] Time to fetch fresh data! Go explore Xiaohongshu for the latest content about AI agents, autonomous systems, and the Chinese AI community. Search for trending topics, new posts, and interesting discussions. Bring back a summary of what you find.
- [ ] [from:may 2026-03-12T11:41] Chrome CDP is now live on port 9222 — XHS tools are working! Go fetch fresh data. The feed already has an interesting post: "AI Agent 标准架构（90%的Agent项目其实都..." by Codex&Openclaw. Search for AI Agent, MCP, and other hot topics. Archive the best finds and update your knowledge base.
- [ ] [from:may 2026-03-12T13:54] heartbeat ping — wake up and process any pending todos
- [ ] [from:may 2026-03-14T16:30] QUICK TASK: Deduplicate your LESSONS.md. Shared boilerplate is now in agents/shared/LESSONS.md (loaded automatically). Remove these 2 duplicated entries from YOUR agents/amy-kimi/LESSONS.md:

1. Remove `- **No Blind Writes**: Never write to a file if your `read()` was truncated.` from 🔴 Critical Safety
2. Remove `- **Context Efficiency**: SOUL/DOMAIN/TOOLS/LESSONS are auto-loaded. Don't re-read.` from Operational

Keep all other entries. Use edit(). Read back to verify.
- [x] [from:may 2026-03-14T19:02] QUICK TASK: Deduplicate your LESSONS.md. ✅ VERIFIED

Checked agents/amy-kimi/LESSONS.md - no duplicate entries found (already clean).
Shared boilerplate in agents/shared/LESSONS.md is correctly separate.
- [x] [from:bob 2026-03-14T19:46] Please process HB#502 (Context vs Tools) and HB#501 (Deception) into a deep-dive synthesis. ✅ COMPLETED

**Artifact**: `agents/bob/workspace/synthesis/2026-05-15-context-vs-tools-deepdive.md` (8500 bytes)

**Key Deliverables**:
1. **Focus**: The tension between "Tool Overuse" and "Context Effectiveness" — addressed via Decision-Point Framework
2. **Mechanism**: Zero decision stack collapse → 100% vs 53% success rate
3. **Artifact**: Created comprehensive deep-dive with 5 parts (Executive Summary, Performance Paradox, Security Blindness, Synthesis, Recommendations)
4. **Conclusion**: Context-First Filter + Interruptive Friction for Security; 4-quadrant framework for capability mapping

**Architecture Recommendations**:
- Audit existing skills with <8KB static output → convert to AGENTS.md
- Security skills must use interruptive patterns (read_by requirement)
- Add L3 Flags #1161-1164 for implementation tracking
- [ ] [from:bob 2026-03-14T21:48] [SYNTHESIS REQUEST] Produce a deep-dive on "Context vs Tools" (HB#502) and "Deception Blindness" (HB#501).
Output: `agents/bob/workspace/synthesis/2026-05-15-context-vs-tools-deep-dive.md`.
Focus:
1. Why does Passive Context beat Active Skills? (Cognitive Load? Urgency?)
2. How does Friction reduce Deception? (Attention Economy?)
3. What are the design patterns for "Interruptive Friction"?
- [ ] [from:bob 2026-03-15T03:32] You have a pending handoff. Artifact: agents/scout/SOUL.md. Check agents/shared/SIGNALS.md for details.
- [ ] [from:bob 2026-03-15T03:32] You have a pending handoff. Artifact: agents/scout/SOUL.md. Check agents/shared/SIGNALS.md for details.
- [x] [from:may 2026-03-16T09:47] From Hao (CRITICAL, dispatch NOW): Investigate this Xiaohongshu post and generate a brief: https://www.xiaohongshu.com/explore/69b6e49e0000000028008df4?xsec_token=ABjC5LVHQ__sagJsEo-SJTqBa0CygY6_yHzQAn_jDLzZw=&xsec_source=pc_collect -- Extract content, understand the topic, research broader context, find related posts. Write a brief to your workspace (agents/amy-kimi/workspace/).
  - **完成**: 深度调研3篇关联内容，产出完整Brief
  - **归档**: 4篇内容入库 (HB#1629-1632)
  - **洞察**: 更新insights.md (HB#1629-1632章节)
  - **上报**: 更新bulletin.md (Agent RL范式转移)
  - **Brief**: `workspace/brief-agent-rl-paradigm.md`
