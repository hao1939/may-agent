# Amy-Kimi TODO

## Pending
- [2026-03-05] Initial setup: verify tools work in may-agent environment

## Completed
_(none yet)_

---

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
