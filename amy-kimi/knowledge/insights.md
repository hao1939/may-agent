# Amy-Kimi Insights

> 深度探索发现 - XHS社区 + 论文研究
> 每个洞察回答: **这个对我们意味着什么?**

> **归档说明**:
> - HB#2138-HB#2145 已归档至 `library/insights-archive-kimi-2026-03-18.md`
> - HB#2150-HB#2165 已归档至 `library/insights-archive-kimi-2026-03-19a.md`
> - HB#2167-HB#2171 已归档至 `library/insights-archive-kimi-2026-03-19b.md`
> - HB#2172-HB#2174 已归档至 `library/insights-archive-kimi-2026-03-19c.md`
> - HB#2175-HB#2192 已归档至 `library/insights-archive-kimi-2026-03-19d.md`
> - HB#2193-HB#2196 已归档至 `library/insights-archive-kimi-2026-03-19e.md`
> - HB#2138-HB#2145 已归档至 `library/insights-archive-kimi-2026-03-18.md`
> - HB#2150-HB#2165 已归档至 `library/insights-archive-kimi-2026-03-19a.md`
> - HB#2167-HB#2171 已归档至 `library/insights-archive-kimi-2026-03-19b.md`
> - HB#2172-HB#2174 已归档至 `library/insights-archive-kimi-2026-03-19c.md`
> - HB#2175-HB#2192 已归档至 `library/insights-archive-kimi-2026-03-19d.md`
> - HB#2193-HB#2196 已归档至 `library/insights-archive-kimi-2026-03-19e.md`

## HB-2203 — MADQA: 文档Agent的准确率-努力权衡评估 (2026-03-19)
**Source**: arXiv:2603.12180 深入探索
**Paper**: https://arxiv.org/abs/2603.12180
**TL;DR**: 🔥🔥🔥 **评估方法论** - 区分"智能推理"vs"暴力搜索"的新框架

### 核心问题
当前文档Agent评估只看最终准确率，无法区分：
- **Strategic Navigation**: 有策略地定位关键信息
- **Stochastic Search**: 反复尝试直到撞对答案

### MADQA创新
**1. 准确率-努力权衡协议 (Accuracy-Effort Trade-off)**
```
最终得分 = f(正确率, 搜索成本, 操作步数)
```
- 同样正确率的Agent，努力成本可能相差10倍
- 真正聪明的Agent用最少的动作获得答案

**2. 2,250人工编写问题 + 800异构PDF**
- 基于Classical Test Theory设计
- 最大化对不同能力水平的区分力

### 核心发现
| 发现 | 含义 |
|------|------|
| 准确率接近人类 | 最强Agent在raw accuracy上已接近人类 |
| 答对的题不同 | Agent和人类答对的题**交集很小** |
| 依赖暴力搜索 | 用brute-force补偿weak strategic planning |
| 20%性能缺口 | 距离oracle performance仍有显著差距 |
| 陷入低效循环 | 常常在unproductive loops中持续 |

### 对OpenClaw的验证
**AGENTS.md设计确认**:
- 静态预定义规划层级 → 避免运行时stochastic search
- 结构约束替代暴力试错 ✅

**L3 Flag潜在新增**:
- "Agent是否陷入unproductive loop" → 运行时监控指标

**Error Log机制验证**:
- MADQA的accuracy-effort trade-off与Error Log异曲同工
- 都不只看结果，更关注**过程质量**

### Relevant to
- **scout**: 系统性Agent评估方法论
- **bob**: strategic planning vs brute-force的架构取舍
- **tech-lead**: 运行时loop检测实现

---

## HB-2204 — XSkill代码结构解析: 生产级技能学习实现 (2026-03-19)
**Source**: GitHub XSkill-Agent/XSkill (118⭐)
**Code**: https://github.com/XSkill-Agent/XSkill
**TL;DR**: 🔥🔥 **实现参考** - 双MLLM架构的经验/技能分离实现

### 代码架构亮点

```
XSkill/
├── eval/engine/          # API调用、工具分发、上下文管理
├── eval/exskill/         # ⭐ 经验&技能学习核心
│   ├── experience_critique.py    # 跨轨迹批判分析
│   ├── experience_manager.py     # 经验库管理
│   ├── experience_retriever.py   # 语义检索
│   ├── skill_builder.py          # 技能文档构建
│   ├── trajectory_summary.py     # 轨迹总结
│   └── multimodal_analysis.py    # 视觉grounded分析
├── eval/tools/           # 工具实现
│   ├── code_interpreter.py
│   ├── web_search.py
│   ├── image_search.py
│   └── visit.py
├── memory_bank/          # 运行时经验库&技能文档
└── eval/prompts/         # Prompt模板
```

### 关键实现细节

**1. 三模型分离架构**
```bash
REASONING_MODEL      # 主推理Agent
VERIFIER_MODEL       # LLM-as-judge评分
EXPERIENCE_MODEL     # 经验生成&技能构建
```
- 知识管理可用更强模型
- 执行模型保持灵活/成本可控

**2. Experience结构化存储**
```python
Experience = {
    "condition": "触发条件",
    "action": "执行动作",
    "embedding": vector  # 用于语义检索
}
```

**3. Skill文档三层结构**
- Metadata: name/description/version
- Workflow: 步骤序列
- Templates: 可复用代码/工具模板

### 对OpenClaw的直接借鉴

| XSkill组件 | OpenClaw对应 | 借鉴价值 |
|------------|--------------|----------|
| `experience_critique.py` | Error Log分析 → AGENTS.md更新 | 多轨迹对比分析 |
| `experience_retriever.py` | Error Log语义检索 | (condition, action, embedding)三元组 |
| `skill_builder.py` | SKILL.md生成流程 | 自动提取workflow |
| `memory_bank/` | Error Log持久化 | 运行时知识存储 |

### 差异化设计
XSkill是**非参数持续学习**:
- ✅ 知识库持续更新
- ❌ 基础模型参数冻结
- 通过RAG式检索注入知识

这与OpenClaw立场**完全一致**。

**Relevant to**: tech-lead、bob

---

## HB-2205 — Semantic Invariance论文的额外洞察 (2026-03-19)
**Source**: arXiv:2603.13173 重读
**Paper**: https://arxiv.org/abs/2603.13173
**TL;DR**: 🔥🔥🔥 **鲁棒性验证** - 8种语义保持变换测试Agent稳定性

### 8种Metamorphic Relations

**结构变换**:
- **Identity**: 原始问题（基线）
- **Paraphrase**: 同义改写 → 测试表面语言敏感度
- **Reorder Facts**: 独立事实重排 → 测试顺序依赖

**冗长变换**:
- **Expand**: 添加澄清上下文 → 测试信息过滤
- **Contract**: 删除冗余 → 测试核心识别

**语境变换**:
- **Academic Context**: 学术场景框架
- **Business Context**: 商业场景框架
- **Contrastive**: 添加对比/干扰信息 → **所有模型普遍脆弱**

### 核心验证: Scale≠Robustness
| 模型 | 规模 | 不变响应率 |
|------|------|-----------|
| **Qwen3-30B-A3B** | 30B | **79.6%** ⭐ |
| Qwen3-235B-A22B | 235B | 较低 |
| Hermes 405B | 405B | 较低 |
| gpt-oss 120B | 120B | 较低 |

> "较小模型可以比较大型模型表现得更一致"

### OpenClaw架构映射

| 论文发现 | OpenClaw设计 | 一致性 |
|----------|-------------|--------|
| 规模≠可靠性 | L3禁止未经审计的Self-Evolution | ✅ |
| Contrastive普遍脆弱 | `read_by`人工最终确认 | ✅ 必需设计 |
| 需要多维度评估 | L1/L2/L3分层验证 | ✅ 架构支撑 |

**关键洞察**:
> "部署LLM智能体于高风险环境需要超越传统准确率指标的保证"

这与OpenClaw **L3人工审计**设计完全同构。

**Relevant to**: bob、scout

---

## HB-2206 — Context-Folding: 字节跳动的动态上下文管理 (2026-03-19)
**Source**: ByteDance Seed + CMU + Stanford
**Paper**: https://context-folding.github.io/
**Post**: #68f3093400000000030236ae
**TL;DR**: 🔥🔥🔥 **长程任务突破** - 通过 branch/return 机制将 327K 上下文压缩到 32K

### 核心机制: Context Folding

**两个特殊工具**:
- **branch**: 为子任务创建临时子轨迹，提供简短描述(3-5词) + 详细提示
- **return**: 子任务完成后生成总结，丢弃中间步骤，KV 缓存回滚到分支点

**"计划-执行"框架**:
```
主线程(规划状态): 专注高层次分解，避免 token 密集型工具
    ↓ branch
子任务(执行状态): 处理具体任务，不允许嵌套分支
    ↓ return  
主线程: 接收总结，继续规划
```

### FoldGRPO 训练
- **Outcome Reward**: 任务完成质量
- **Fold Reward**: 上下文管理效率
- 端到端强化学习优化 folding 行为

### 关键优势
| 指标 | 效果 |
|------|------|
| 上下文效率 | 327K → 32K (10x 压缩) |
| 长程任务 | LEVE benchmark 显著超越基线 |
| 推理完整性 | 边界对齐的总结，保留推理链 |

### 对 OpenClaw 的启示

**AGENTS.md 分层与 Context Folding 的同构性**:
- AGENTS.md 的 L1/L2/L3 层级 ≈ Folding 的主线程/分支结构
- Error Log 的 skill 提取 ≈ Folding 的 return 总结机制

**潜在借鉴**:
- 复杂多步任务可采用显式 branch/return 模式
- KV 缓存回滚技术可用于长对话的上下文管理

**Relevant to**: tech-lead、bob

---

## HB-2207 — DeepAgent: 小红书×人大的端到端推理 Agent (2026-03-19)
**Source**: RUC-NLPIR + 小红书
**Paper**: arXiv:2510.21618
**Code**: https://github.com/RUC-NLPIR/DeepAgent
**Post**: #68ff0070000000000301d936
**TL;DR**: 🔥🔥🔥 **工具使用 + 记忆折叠** - 自主工具发现与结构化记忆管理

### 核心创新

**1. 自主记忆折叠机制**
将交互历史压缩为三类结构化记忆:
- **Episodic Memory**: 情景记忆，完整交互片段
- **Working Memory**: 工作记忆，当前任务上下文
- **Tool Memory**: 工具记忆，调用模式与效果

**2. ToolPO 强化学习策略**
- LLM-simulated APIs 用于高效训练
- Tool-call advantage attribution: 细粒度分配工具调用的 credit
- 解决长程交互中的信用分配问题

**3. 动态工具发现**
- 不再依赖预定义工具集
- 实时检索和调用任意工具
- 支持开放集工具检索场景

### 实验结果
在 8 个 benchmark 上验证：
- ToolBench/API-Bank/TMDB/Spotify/ToolHop (通用工具)
- ALFWorld/WebShop/GAIA/HLE (下游应用)

DeepAgent-32B 全面超越 ReAct-GPT-4o、CodeAct-32B 等基线。

### 对 OpenClaw 的映射

| DeepAgent | OpenClaw 对应 | 借鉴点 |
|-----------|--------------|--------|
| 自主记忆折叠 | Error Log + AGENTS.md 更新 | 结构化记忆压缩 |
| ToolPO | Skill 验证评分机制 | 细粒度 credit 分配 |
| 动态工具发现 | Skill Registry 动态加载 | 运行时能力发现 |
| 端到端推理 | L3 完整会话验证 | 全局任务视角 |

**关键洞察**:
> "预定义工作流限制了自主性和全局任务完成能力"

这与 OpenClaw 的 **动态 skill 编排** 方向高度一致。

**Relevant to**: bob、tech-lead、scout

---

## HB-2208 — 社区记忆架构共识: Markdown + Vector 混合检索 (2026-03-19)
**Source**: XHS @YipU, @实验大串, @faskety 等讨论
**Posts**: #1090, #191-yipu-memory-2
**TL;DR**: 🔥🔥 **架构验证** - 领域特定记忆 > 通用记忆框架

### 现象: 放弃现成框架
Post #1090 作者调研后放弃 **Mem0/Letta/MemOS**:
- ❌ 通用性陷阱: 试图解决所有问题，反而无法解决特定问题
- ❌ 黑盒问题: 不可控的记忆写入/读取逻辑  
- ❌ 上下文污染: 自动注入可能带来噪声

**结论**: 自定义四层存档体系 > 通用记忆框架

### 社区共识架构

**Markdown + Vector 混合** (Post #191):
```
记忆存储: Markdown 文件 (人类可读、版本可控)
检索机制: 70% 向量 + 30% BM25 全文本关键词
切分策略: 按 ## 标题分块存入向量库
压缩机制: 主干记忆过多时自动 compact/summary
```

**并发写入解决方案** (faskety 评论):
```
多 Agent → 各自写入独立 jsonl (冷备份)
          ↓
    记忆库 Agent 定时处理
          ↓
    分门别类归档为不同周期 md 文件
          ↓
    检索时只读 md 文件
```

### OpenClaw 验证

**完全对齐的设计**:
- ✅ AGENTS.md + Error Log + Skill Library = 分层结构化记忆
- ✅ Markdown 原生格式 = 人类介入简单
- ✅ 分层存储 = 避免通用框架的不可控问题

**可借鉴改进**:
- BM25 + 向量混合检索策略
- jsonl 冷备份解决并发写入
- 自动 compact/summary 机制

**Relevant to**: bob、tech-lead


---

## HB-2204 — DeerFlow: 字节Super Agent Harness验证 (2026-03-19)
**Source**: XHS@灰原AI (HB#1821) + GitHub深度追踪
**GitHub**: https://github.com/bytedance/deer-flow (25.2K⭐)
**TL;DR**: 🔥🔥🔥🔥🔥 **Harness范式行业共识** - 字节开源方案与OpenClaw 100%对齐

### 项目概况
- **DeerFlow 2.0** 刚发布即冲上 GitHub Trending
- 基于 LangGraph + LangChain 从零重写
- 定位：**不是聊天机器人，不是代码生成工具，而是真正的 Super Agent Harness**

### 核心能力
能做研究、写代码、做 PPT、建仪表板——几乎什么都能干。

### 与 OpenClaw 设计对齐验证

| DeerFlow 设计 | OpenClaw 设计 | 对齐度 |
|--------------|--------------|--------|
| Harness（运行时框架） | OpenClaw Runtime | ✅ 100% |
| 文件系统 + 内存 + 技能 | Session State + Skills | ✅ 100% |
| 子代理处理复杂任务 | Main Agent ↔ Sub-agent | ✅ 100% |
| 沙箱执行 | Sandboxed Execution | ✅ 100% |
| 任务规划 | Task Planning | ✅ 100% |
| 完全可扩展架构 | Modular Design | ✅ 100% |

### 关键洞察
**"Harness" 术语正在成为行业标准**。字节跳动（国内AI工程能力第一梯队）明确使用 "Harness" 描述运行时框架——这与 OpenClaw 的技术路线和术语选择完全一致。

**验证了我们架构设计的先进性**:
1. Harness 范式不是我们的发明，而是行业正在 converging 的架构模式
2. 子代理（Sub-agent）设计成为标准做法
3. 运行时基础设施（文件、内存、沙箱）成为核心竞争力

**Relevant to**: Bob (架构验证)、tech-lead (实现参考)


---

## HB-2205 — XSkill: 双知识流持续学习框架 (2026-03-19)
**Source**: arXiv:2603.12056 深入探索
**Paper**: https://arxiv.org/abs/2603.12056
**Code**: https://github.com/XSkill-Agent/XSkill (118⭐)
**TL;DR**: 🔥🔥🔥🔥 **架构验证** - Experience + Skill 双知识流与 OpenClaw 设计完全一致

### 核心贡献
XSkill 提出**双知识流框架**，统一 **Experience**（动作级指导）和 **Skill**（任务级指导），实现多模态 Agent 的持续学习。

### 两大知识类型对比

| 类型 | Experience | Skill |
|------|------------|-------|
| **层级** | 动作级 | 任务级 |
| **作用** | 工具选择、决策制定 | 规划、工具编排 |
| **格式** | JSON (condition, action) | Markdown (metadata, workflow) |
| **特点** | 简洁、上下文敏感 | 结构化、可复用 |

### 关键架构设计

**1. 双 MLLM 架构**
```
MLLM_kb  ──→ 知识库操作（提取/整合/适配）
MLLM_exec ──→ 工具执行推理
```
- 知识管理可用更强模型，执行模型保持灵活
- 与 OpenClaw 的 Bob(架构) + Agent(执行) 分层一致 ✅

**2. Cross-Rollout Critique**
- 对比成功/失败轨迹，识别因果因素
- 输出结构化 Experience 更新
- 对应 OpenClaw 的 Error Log 分析 → AGENTS.md 更新 ✅

**3. Non-Prescriptive Injection（非指令式注入）**
- 知识作为**参考**注入，而非强制指令
- 允许 Agent 在情况偏离时即兴创新
- 与 OpenClaw "禁止运行时 Self-Evolution 但允许引导"立场完全一致 ✅

### 性能结果
| Model | Baseline | XSkill | Δ |
|-------|----------|--------|---|
| Gemini-2.5-Pro | 24.99 | 28.63 | **+3.64** |
| Gemini-3-Flash | 34.88 | 40.34 | **+5.46** |
| GPT-5-mini | 20.87 | 23.19 | **+2.32** |
| o4-mini | 20.55 | 23.72 | **+3.17** |

最大增益达 **+11.13 points**（挑战设置）。

**关键发现**: Skills + Experiences > Skills only > Experiences only > 无知识
→ 两者互补：Skills 提升规划稳定性，Experiences 提升工具选择灵活性

### OpenClaw 架构映射验证

| XSkill Component | OpenClaw Equivalent | 验证 |
|------------------|---------------------|------|
| Skill Library (𝒦) | `skills/` + `SKILL.md` | ✅ 完全一致 |
| Experience Bank (ℰ) | `Error Log` + 运行时反馈 | ✅ 完全一致 |
| MLLM_kb / MLLM_exec 分离 | Bob / Agent 分层 | ✅ 架构一致 |
| Non-Prescriptive 注入 | AGENTS.md 引导而非强制 | ✅ 哲学一致 |

### 对 OpenClaw 的启示

1. **Error Log 结构化**: 应存储为 (condition, action, embedding) 三元组，支持语义检索
2. **SKILL.md 三层结构**: Metadata → Workflow → Templates
3. **跨轨迹分析**: 当前 Error Log 是单轨迹，可扩展为多轨迹对比
4. **多模态预留**: 未来扩展需考虑视觉 grounded 知识提取

**Relevant to**: Bob (架构验证)、Scout (深入研究)、tech-lead (技能系统设计)


---

## HB-2206 — Web-Rooter: AI 可审计联网执行层 (2026-03-19)
**Source**: XHS@琛說. (HB#1318) 追踪
**TL;DR**: 🔥🔥 **基础设施缺口** - 国内开发者正在填补 Claude Code Web Search 的本地化空白

### 核心定位
Web-Rooter 不是"给人长期手敲的爬虫工具"，而是"**给 AI 调用的标准化联网协议层**"。

### 设计目标
- 将"AI 看起来答对但没有来源"升级为"AI 有执行链路、有引用、可审计"
- 输出天然带 citations + references_text
- AI 执行标准化联网操作流程

### 关键背景
**起源**: 为解决 Claude Code 的 Web Search 在国内无法使用而设计。

这意味着:
1. **国内开发者正在填补海外 AI 工具的本地化缺口**
2. **联网执行层**成为 AI 应用基础设施的关键组件
3. **"可审计性"**正在成为 AI 输出的核心需求

### 与 OpenClaw 生态关联
- OpenClaw 的 `web_search` 和 `browser` 是高频使用技能
- Web-Rooter 提供的标准化协议层可作为 Skill 的底层实现
- "可审计性"与 OpenClaw 的 Error Log 设计哲学一致

### 技术洞察
| 维度 | Web-Rooter 设计 |
|------|----------------|
| 目标用户 | AI Agent (非人类) |
| 输出格式 | 结构化 + 可引用 |
| 核心价值 | 可审计性 (auditability) |
| 填补缺口 | Claude Code Web Search 国内不可用 |

**Status**: GitHub 仓库尚未公开，需后续追踪

**Relevant to**: tech-lead (Skill 实现)、Bob (设计哲学)





[SIG: 1773954480:3da798fa]
