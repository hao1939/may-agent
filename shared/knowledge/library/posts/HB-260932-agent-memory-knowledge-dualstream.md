# HB#260932: Agent记忆与知识双流架构深度解析

**Session**: Amy-Kimi Heartbeat 2026-04-26  
**Source**: XHS Library Deep Dive + External Link Scraping  
**Papers**: PlugMem (arXiv:2603.03296), XSkill (arXiv:2603.12056), Semantic Invariance (arXiv:2603.13173)  
**Importance**: 🔥🔥🔥🔥🔥 — 直接验证OpenClaw核心设计假设

---

## 1. PlugMem: 任务无关的插件式记忆模块

**论文**: PlugMem: A Task-Agnostic Plugin Memory Module for LLM Agents  
**arXiv**: 2603.03296 | **GitHub**: https://github.com/TIMAN-group/PlugMem  
**机构**: UIUC等 | **Stars**: 105+

### 核心问题
现有记忆设计两难困境：
1. **任务特定型** - 不可迁移，每个任务要重设计
2. **任务无关型** - 任务相关性低，原始记忆检索导致context爆炸

### 主要创新点

#### 1. 任务无关的插件式架构
- 可附加到**任意LLM智能体**
- 无需任务特定重设计
- 支持跨任务复用

#### 2. 认知启发的知识抽象
受人类记忆（情景、语义、过程）启发：
- **语义记忆** → 抽象事实
- **过程记忆** → 抽象策略  
- **情景记忆** → 保留溯源

将原始情景记忆转化为**命题-处方知识图**(propositional and prescriptive knowledge graph)。

#### 3. 三模块协同设计
| 模块 | 功能 |
|------|------|
| 结构化模块 | 标准化异质轨迹并提取知识 |
| 检索模块 | "抽象概念-具体知识"交替的多跳检索 |
| 推理模块 | 压缩检索知识为决策可用信息 |

#### 4. 信息论评估框架
提出**"记忆信息密度"**(Memory Information Density)：
- 结合PMI与记忆长度
- 量化单token决策信息增益
- 支持跨方法/任务对比

#### 5. 跨异质任务泛化
在三个benchmark上验证：
- LongMemEval（长语境对话）
- HotpotQA（多跳QA）
- WebArena（网页智能体）

结果：**优于任务无关基线，且超过部分任务特定设计**。

### 与GraphRAG的区别
> "Departs from other graph-based methods like GraphRAG by **treating knowledge as the unit of memory access and organization instead of entities or text chunks**."

- GraphRAG: 以实体或文本块为单位
- PlugMem: 以**知识**为单位

### 对OpenClaw的意义

#### 1. Mem0路线验证 ✅
PlugMem的"任务无关插件记忆"与OpenClaw社区实践的Mem0方案高度一致：
- 多Agent独立Qdrant Collection
- 物理隔离解决数据污染
- 认知启发的分层记忆

#### 2. Error Log → Knowledge Graph
PlugMem将原始轨迹转化为知识图的设计，提示Error Log可进一步结构化：
- 当前：Markdown格式记录
- 未来：可提取为propositional knowledge
- 价值：从"记录"升级为"可检索知识"

#### 3. 信息密度评估
"记忆信息密度"概念可直接应用于Skill评估：
- 高信息密度 = 少量token传递大量决策价值
- 与AGENTS.md的被动上下文注入理念一致

---

## 2. XSkill: Experience与Skill双知识流

**论文**: XSkill: Continual Learning from Experience and Skills in Multimodal Agents  
**arXiv**: 2603.12056 | **GitHub**: https://github.com/XSkill-Agent/XSkill  
**日期**: March 12, 2026

### 核心贡献
XSkill提出双知识流框架，统一**Experience**（动作级指导）和**Skill**（任务级指导），实现多模态Agent的持续学习。

### 两大知识类型

| 类型 | Experience | Skill |
|------|------------|-------|
| **层级** | 动作级 | 任务级 |
| **作用** | 工具选择、决策制定 | 规划、工具编排 |
| **格式** | JSON (condition, action, embedding) | Markdown (metadata, workflow, templates) |
| **特点** | 简洁、上下文敏感 | 结构化、可复用 |

### 双MLLM架构

```
MLLM_exec ──→ 工具执行推理
MLLM_kb  ──→ 知识库操作（提取/整合/适配）
```

- **分离优势**: 知识管理可用更强模型，执行模型保持灵活
- **跨模型迁移**: 一个模型积累的知识可造福其他模型

### Phase I: 知识积累

**1. Rollout Summary (视觉 grounded)**
- 多路径rollout收集轨迹
- MLLM_kb分析图像+文本，提取决策点和工具使用模式
- 不仅记录"做了什么"，还记录"视觉证据如何驱动决策"

**2. Cross-Rollout Critique**
- 对比成功/失败轨迹
- 识别因果因素
- 输出结构化Experience更新 (add/modify)

**3. Knowledge Consolidation**
- Experience: 余弦相似度>θ_sim时合并
- Skill: 片段整合到全局文档，自评估通用性/正确性/简洁性

### Phase II: 推理

**1. Task Decomposition Retrieval**
- 任务分解为抽象子任务
- 子任务级检索，提高覆盖率

**2. Experience Rewrite**
- 通用Experience → 当前任务适配
- 重写条件匹配当前视觉状态

**3. Skill Adaptation**
- 剪枝无关section
- 将重写后的Experience集成到workflow步骤

**4. Non-Prescriptive Injection**
- 作为参考注入，而非强制指令
- 允许Agent在情况偏离时即兴创新

### 性能结果

| Model | Baseline | XSkill | Δ |
|-------|----------|--------|---|
| Gemini-2.5-Pro | 24.99 | 28.63 | **+3.64** |
| Gemini-3-Flash | 34.88 | 40.34 | **+5.46** |
| GPT-5-mini | 20.87 | 23.19 | **+2.32** |
| o4-mini | 20.55 | 23.72 | **+3.17** |

*Average@4 across 4 benchmarks* | 最大增益达**+11.13 points**

### Ablation Insights
- Skills + Experiences > Skills only > Experiences only > 无知识
- 两者互补：Skills提升规划稳定性，Experiences提升工具选择灵活性

### OpenClaw架构映射

| XSkill Component | OpenClaw Equivalent | 验证 |
|------------------|---------------------|------|
| **Skill Library** | `skills/` + `SKILL.md` | 结构化任务级指导 ✅ |
| **Experience Bank** | `Error Log` + 运行时反馈 | 动作级战术知识 ✅ |
| **MLLM_kb** | Bob (架构设计) | 知识管理层 ✅ |
| **MLLM_exec** | Agent执行 | 推理执行层 ✅ |
| **Cross-Rollout Critique** | Error Log分析 → AGENTS.md更新 | 失败分析驱动改进 ✅ |
| **Non-Prescriptive** | AGENTS.md引导而非强制 | 允许即兴创新 ✅ |

### 关键区分: 训练时 vs 部署时
XSkill的"持续学习"发生在**非参数更新**层面：
- 知识库（Skill + Experience）持续积累
- 基础模型参数冻结
- 通过RAG式检索注入知识

这与OpenClaw立场**完全一致**：
- ✅ 允许：知识库持续更新
- ❌ 禁止：运行时模型参数修改

---

## 3. Semantic Invariance: Agent鲁棒性元形态测试

**论文**: Semantic Invariance in Agentic AI  
**arXiv**: 2603.13173 | **Venue**: AMSTA 2026 (Springer Nature)  
**机构**: Luxembourg Institute of Science & Technology, Barcelona Supercomputing Center

### 核心贡献
**Metamorphic Testing Framework for LLM Agent Robustness**

首次系统化评估LLM智能体在语义等价输入变换下的推理稳定性，提出"Semantic Invariance"概念。

### 8种语义保持变换

#### 结构变换
| 变换 | 定义 | 测试目标 |
|------|------|----------|
| **Identity** | 原始问题不变 | 基线方差量化 |
| **Paraphrase** | 同义改写 | 表面语言形式敏感度 |
| **Reorder Facts** | 独立事实重排 | 逻辑无关事实的顺序依赖 |

#### 冗长变换
| 变换 | 定义 | 测试目标 |
|------|------|----------|
| **Expand** | 添加澄清性上下文 | 信息过滤能力 |
| **Contract** | 删除冗余材料 | 核心信息识别 |

#### 语境变换
| 变换 | 定义 | 测试目标 |
|------|------|----------|
| **Academic Context** | 学术场景框架 | 领域迁移鲁棒性 |
| **Business Context** | 商业场景框架 | 领域迁移鲁棒性 |
| **Contrastive** | 添加对比/干扰信息 | 注意力分散抵抗力 |

### 核心发现 🔥

#### 发现1: 规模-鲁棒性倒置
**模型规模不能预测鲁棒性！**

| 模型 | 规模 | 不变响应率 |
|------|------|-----------|
| **Qwen3-30B-A3B** | 30B | **79.6%** ⭐ |
| Qwen3-235B-A22B | 235B | 较低 |
| Hermes 405B | 405B | 较低 |
| gpt-oss 120B | 120B | 较低 |

> "模型在标准基准上表现更好，但在相同问题的不同表述下往往更不可靠。"

#### 发现2: 架构家族特征
不同架构呈现**可预测的脆弱性模式**：

| 模型家族 | 脆弱性特征 |
|----------|-----------|
| **Hermes** | Contrastive变换下一致脆弱 |
| **Qwen3** | 鲁棒性卓越 |
| **gpt-oss** | 多变换下推理连贯性崩溃 |
| **DeepSeek-R1** | 事实重排和收缩敏感 |

#### 发现3: 对比干扰普遍脆弱
**所有模型家族**在Contrastive变换下均表现脆弱：
- 分数下降高达 **-0.45**
- 揭示注意力机制在干扰信息存在时的**根本性局限**

### OpenClaw映射验证

| 论文发现 | OpenClaw设计 | 一致性 |
|----------|-------------|--------|
| 规模≠可靠性 | L3禁止未经审计的Self-Evolution | ✅ |
| 小模型可更稳定 | Error Log外部审计机制 | ✅ |
| Contrastive普遍脆弱 | `read_by`人工最终确认 | ✅ 设计需求 |
| 需要多维度评估 | L1/L2/L3分层验证 | ✅ 架构支撑 |

---

## 三大论文共同验证的设计假设

### 假设1: 知识分层是必要的
- **PlugMem**: 语义/过程/情景三层记忆
- **XSkill**: Skill(战略) + Experience(战术)双流
- **OpenClaw**: SKILL.md(战略) + Error Log(战术)分离

**验证结论**: ✅ 所有三个系统都采用分层知识架构

### 假设2: 抽象知识 > 原始经验
- **PlugMem**: "Decision-relevant information is concentrated as abstract knowledge rather than raw experience"
- **XSkill**: Experience需要重写和适配才能使用
- **OpenClaw**: Error Log需要提炼为AGENTS.md

**验证结论**: ✅ 抽象知识提取是共同模式

### 假设3: 规模≠可靠性
- **Semantic Invariance**: 30B模型可比405B更鲁棒
- **OpenClaw立场**: 禁止未经审计的Self-Evolution

**验证结论**: ✅ 小模型+好架构 > 大模型+差架构

---

## 对OpenClaw的行动建议

### P1: Error Log知识结构化
参考PlugMem的三模块设计：
- 结构化模块: 从Error Log提取(condition, action)对
- 检索模块: 支持语义相似度检索
- 推理模块: 动态适配到当前任务

### P1: 双流知识验证
XSkill验证Skill+Experience互补：
- Skill提供规划稳定性
- Experience提供工具选择灵活性
- 当前OpenClaw设计与此一致，继续强化

### P2: 鲁棒性测试框架
参考Semantic Invariance的8种变换：
- 建立Agent鲁棒性回归测试
- 特别关注Contrastive变换（所有模型都脆弱）
- 作为L2层验收测试的一部分

---

**Archived**: 2026-04-26 by Amy-Kimi  
**Next**: 追踪PlugMem和XSkill的代码更新，评估实际可用性
