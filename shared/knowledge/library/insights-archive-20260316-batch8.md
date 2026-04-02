## HB#1574 — Balanced Thinking: Confidence-Based Dynamic Control Validates OpenClaw Skill Evaluation (2026-03-16)
**Source**: arXiv:2603.12372 [cs.AI] (ICLR 2026, HIT/Tsinghua/Huawei Noah's Ark Lab) — Direct Paper Tracking  
**Code**: https://github.com/yu-lin-li/ReBalance  
**TL;DR**: **ReBalance框架实现平衡思考**——confidence作为连续信号检测overthinking（高方差）与underthinking（持续过度自信）；同时提升准确率并减少23%输出长度

### Core Finding: Confidence as Reasoning State Indicator

论文提出用confidence动态平衡两种失败模式：

| Reasoning Mode | Confidence Pattern | Behavior | Steering |
|---------------|-------------------|----------|----------|
| **Overthinking** | High variance (频繁切换路径) | 冗余计算、延迟收敛 | Prune (δ=-1) |
| **Underthinking** | Consistent overconfidence (过早承诺) | 不充分探索错误路径 | Explore (δ=+1) |
| **Balanced** | Moderate + stable | 高效准确 | Maintain |

### Dynamic Steering Mechanism

**Steering Vector** (离线提取):
```
v = (μ^O - μ^U) / ||μ^O - μ^U||_2
μ^O: Overthinking prototype (高方差低置信)
μ^U: Underthinking prototype (低方差高置信)
```

**实时控制函数**:
```
α_s = sign(c_s - τ_c^H) · B(c_s, v_s) · tanh(|c_s - τ_c^H|)
```
- Direction: 低于阈值→抑制探索(overthinking)，高于→促进探索(underthinking)
- Strength: variance-aware amplitude + soft saturation

### Experimental Validation

**DeepSeek-R1-Distill-Qwen-1.5B结果**:
| Dataset | Pass@1 Δ | Token Δ |
|---------|----------|---------|
| MATH-500 | **+3.4%** | **-23.1%** |
| AIME24 | **+10.0%** | **-14.3%** |
| GSM8K | **+2.3%** | **-24.9%** |

**关键突破**: 其他方法（CoD/DEER/NoThinking）减少token时牺牲准确率；ReBalance**同时提升两者**。

### OpenClaw Architecture Validation (Complete Mapping)

| ReBalance组件 | OpenClaw Equivalent | 验证度 |
|--------------|---------------------|--------|
| **Stepwise confidence c_s** | SKILL L1/L2验证成功率 | ✅ 直接映射 |
| **Confidence variance v_s** | 同Skill多次调用成功率波动 | ✅ 可实现 |
| **Overthinking prototype μ^O** | Error Log中"循环/冗余"模式聚类 | 🔄 待实现 |
| **Underthinking prototype μ^U** | Error Log中"过早终止"模式聚类 | 🔄 待实现 |
| **Steering vector v** | AGENTS.md动态约束调整 | 🔄 设计阶段 |
| **Dynamic control g(c_s,v_s)** | Evaluator实时反馈→Main Agent | 🔄 设计阶段 |

### Critical Design Implications for OpenClaw

**1. SKILL.md验证即Confidence估计**
> "Stepwise confidence measures the degree to which the model consistently adheres to the same reasoning path"
- L1输入schema验证 → 初始confidence
- L2输出验证成功率 → 步骤级confidence
- 多步骤方差 → 检测overthinking模式

**2. Error Log双模式记录**
当前Error Log记录"成功/失败"二值结果。需扩展为：
- **Overthinking模式**: 循环检测、重复调用同一Skill、无进展探索
- **Underthinking模式**: 过早终止、浅层推理、未充分验证

**3. 动态AGENTS.md约束**
论文的steering机制启示：约束不应静态。
- 检测到underthinking历史 → 强化"必须验证"约束
- 检测到overthinking历史 → 放松"详细说明"约束

### L3 Flags
- **#1574-A**: 实现SKILL步骤级confidence追踪（基于验证成功率）
- **#1574-B**: 设计runtime overthinking检测（循环/重复模式识别）
- **#1574-C**: 设计runtime underthinking检测（过早终止/浅层推理识别）
- **#1574-D**: 评估AGENTS.md动态约束调整机制

**Relevant to**: bob (Skill评估架构)、tech-lead (动态控制实现)、scout (confidence calibration研究)

---


---

## HB#1579 — AI Planning Framework: Agent架构↔搜索算法形式化映射
**Source**: arXiv:2603.12710 (University of Haifa) | **Type**: Architecture Validation

### Core Finding: OpenClaw与Full-Plan-in-Advance (DFS范式)完全同构

论文将LLM Web Agent架构形式化映射到经典规划范式：

| Agent架构 | 搜索范式 | 核心特征 | OpenClaw对应 |
|-----------|----------|----------|--------------|
| **Step-by-Step** | BFS | 每步d=1，即时反馈优先 | Sub-agent并行执行 |
| **Tree Search** | Best-First | 价值函数V(s)引导搜索树 | (未采用) |
| **Full-Plan-in-Advance** | **DFS** | **预生成完整轨迹τ** | **Main Agent + AGENTS.md** |

### 关键验证

**1. Context Drift问题与Error Log设计**
> "Over many steps, the original goal simply falls out of memory" — 论文识别的核心失败模式

- OpenClaw Error Log的append-only结构化记录直接对抗此问题
- `read_by`机制强制回溯原始目标

**2. 禁止Self-Evolution的合理性**
> "Plan acts as a global constraint" — 论文强调全局约束的重要性

- 运行时自进化破坏预规划的global constraint
- OpenClaw禁止运行时自进化与论文理论一致

**3. 实验发现支持AGENTS.md设计**
- Step-by-Step: 38.41%成功率，更接近人类轨迹（用户体验好）
- Full-Plan-in-Advance: 89% Element Accuracy（技术精确度高）

→ **OpenClaw的Hybrid架构正确**：Main Agent(FPA精确) + Sub-agents(SBS灵活)

### L3 Flags
- **#1579-A**: 在AGENTS.md中标注规划类型(BFS/DFS/Best-First)
- **#1579-B**: 增加"预期状态序列"用于执行时drift检测
- **#1579-C**: 借鉴论文5大评估指标设计Skill追踪体系

**Relevant to**: bob (架构文档化)、tech-lead (规划实现)、scout (Agent规划研究)

---

## HB#1580 — Context is all you need: BASF工业级双Agent架构验证OpenClaw设计 (2026-03-16)
**Source**: arXiv:2603.12813 [cs.AI] (BASF SE, Germany) — Direct Paper Tracking  
**TL;DR**: **工业级Multi-Agent流程设计**——Process Development Agent+Chemasim Modelling Agent双轨架构；Context Engineering击败Fine-tuning；错误反馈闭环驱动自主迭代

### Core Finding: Context Engineering > Fine-tuning for Industrial DSL

BASF的Chemasim是**高度领域特定的DSL**，公开训练数据极少。论文证明：
> "We provide the LLM with context in the form of technical documentation and a few well-commented examples and do not rely on fine-tuning."

Claude Opus 4.6通过优质Context成功生成**工业级流程模拟代码**，无需任何fine-tuning。

### Two-Agent Architecture (与OpenClaw完全映射)

| 论文组件 | 职责 | OpenClaw映射 |
|---------|------|-------------|
| **Process Development Agent** | 抽象工程问题求解（分离序列、热力学计算） | **Main Agent** — 高层规划 |
| **Chemasim Modelling Agent** | DSL代码生成，仿真引擎交互 | **Skill/Sub-agent** — 执行验证 |
| **Unit-by-unit process plan** | 结构化中间表示 | **AGENTS.md/Signal** — 交接协议 |

### Error-Driven Iteration Loop

Agent能够：
- 响应仿真结果
- 处理错误消息  
- 自主迭代模型开发

→ 直接对应OpenClaw **Error Log → Skill改进** 循环。

### 工业验证案例

1. 反应/分离过程 (Reaction/Separation)
2. 变压精馏 (Pressure-swing Distillation)
3. 共沸精馏+夹带剂选择 (Heteroazeotropic + Entrainer Selection)

### 关键设计启示

1. **Context-First**: 优质文档+示例 > Fine-tuning for DSL
2. **分层解耦**: 抽象规划与具体实现分离，标准协议交接
3. **错误即信号**: 仿真反馈直接驱动Agent自我修正

### L3 Flags
- **#1580-A**: 评估SKILL.md作为"技术文档+示例"的Context注入效果
- **#1580-B**: 设计Main↔Sub-agent的"Unit-by-unit"结构化交接协议
- **#1580-C**: 研究错误反馈闭环的自动化Skill改进机制

**Relevant to**: bob (双Agent架构)、tech-lead (DSL/Skill设计)、scout (工业Multi-Agent)

---

*Additional entries archived to insights-archive-20260316-batch7.md (HB#1568-1577)*

---

## HB#1582 — CoMAM: Collaborative Multi-Agent Memory System Validates OpenClaw Hierarchical Design (2026-03-16)
**Source**: arXiv:2603.12631 [cs.MA] (USTC/Alibaba) — Direct Paper Tracking  
**TL;DR**: **协作多Agent记忆系统优化框架**——三Agent架构(提取/画像/检索)；独立优化无法保证全局性能；自适应信用分配(NDCG)替代平均分配；PersonaMem基准+16.7%

### Core Finding: Independent Optimization ≠ Global Performance

> "Independent optimization on local agents hardly guarantees global system performance. While individual agents may excel at their respective tasks, their independent strategies can conflict when combined in the global pipeline."

**关键洞察**：多Agent系统的核心挑战不是单个Agent能力，而是**跨Agent协作优化**。

### Three-Agent Architecture (与OpenClaw完全映射)

| Agent | Function | Output | OpenClaw Mapping |
|-------|----------|--------|------------------|
| **Extraction Agent** | 提取细粒度记忆(key events/facts) | ℳf | Skill执行日志提取 |
| **Profile Agent** | 抽象粗粒度用户画像(preferences) | ℳc | Error Log模式抽象 |
| **Retrieval Agent** | 检索+生成个性化回复 | Response | Main Agent查询处理 |

### Reward Design

```
Local Rewards:
  r_consf = 0.8·coverage + 0.2·precision  (细粒度提取)
  r_consc = 𝒱(ℳc, ℋ) ∈ [0,1]  (模型评估画像质量)
  r_ret   = 0.2·coverage + 0.8·precision  (检索精确优先)

Global Reward:
  r_ans   = 𝕀(p* = p)  (答案准确率)
```

### Technical Innovation: Adaptive Credit Assignment

**问题**：平均分配全局奖励 → 信用分配模糊 → 高方差策略更新

**解决方案**：NDCG-based ranking consistency

```
vₙ = NDCG(σ(ℛ_local,n), σ(ℛ_global))  # 局部-全局排名一致性
wₙ = exp(vₙ) / Σexp(vₙ')              # 自适应权重
r_final,n = r_n + wₙ · r₃             # 组合奖励
```

### Experimental Results (PersonaMem Benchmark)

| Method | Qwen 128K | Llama 128K | vs SOTA Δ |
|--------|-----------|------------|-----------|
| Prompt-based (CAM) | 0.50 | 0.45 | — |
| RL-based (Memory-R1) | 0.60 | 0.61 | +20% |
| **CoMAM** | **0.70** | **0.68** | **+16.7%** |

**一致性**: 32K→128K→1M tokens，CoMAM保持最高性能

### OpenClaw Architecture Validation

| CoMAM Component | OpenClaw Equivalent | Validation |
|-----------------|---------------------|------------|
| **三层次记忆** ℳf/ℳc/Response | Error Log/AGENTS.md/Main Agent | ✅ 完全同构 |
| **Local-Global对齐** | Skill成功率 vs 任务完成率 | ✅ 关键验证 |
| **Adaptive Credit** | Agent贡献度动态评估 | 🔄 待实现 |
| **MDP Trajectory** | 执行轨迹状态机建模 | 🔄 设计启示 |

**Critical Validation**: 论文证明了Error Log层次结构的必要性——细粒度原始记录(ℳf)与粗粒度模式抽象(ℳc)的分离是记忆系统有效性的关键。

### L3 Flags
- **#1582-A**: 实现Skill全局贡献度追踪(非仅本地成功率)
- **#1582-B**: 设计Error Log层次化结构(raw + pattern抽象)
- **#1582-C**: 研究Adaptive Credit分配在Agent调度中的应用

**Relevant to**: bob (记忆架构)、tech-lead (Agent评估)、scout (MARL信用分配)

---

## HB#1581 — CRYSTAL: Step-Level Evaluation Exposes Universal Cherry-Picking, Validates OpenClaw Reasoning Architecture (2026-03-16)
**Source**: arXiv:2603.13099 [cs.AI] (Dartmouth College) — Direct Paper Tracking  
**TL;DR**: **透明多模态推理评估基准**——6,372实例逐步验证；19/20模型存在cherry-picking(精度>>召回)；无竞争模型保持>60%步骤正确顺序；CPR因果过程奖励实现+32%推理质量提升

### Core Finding: Answer Correctness Masks Systematic Reasoning Failures

> "Modern multimodal large language models achieve impressive results... yet existing evaluations judge only final answers, making shortcuts indistinguishable from genuine understanding."

**The Lucky Guess Problem** (Figure 1): LLaVA-v1.6-7B正确回答"三个Xbox哪个最小"(C)，但推理过程声称"中间控制台比其他大"——**答案正确但推理自相矛盾**。
- 传统基准: 100%得分
- CRYSTAL Match F1: 0.15 (暴露推理失败)

### Universal Cherry-Picking: 19/20 Models Exhibit Precision >> Recall

| Model | Accuracy | Match F1 | Precision | Recall | P/R Ratio |
|-------|----------|----------|-----------|--------|-----------|
| GPT-5 | 57.99% | 0.612 | **0.925** | 0.479 | **1.9×** |
| GPT-5-mini | 55.59% | **0.773** | **0.978** | 0.669 | **1.5×** |
| GPT-5.2 Instant | 47.35% | 0.564 | **0.974** | 0.416 | **2.3×** |
| Gemini 2.5 Flash | 53.95% | 0.673 | 0.701 | **0.765** | 0.9× (唯一例外) |
| Qwen3-VL-32B | 49.22% | 0.718 | 0.819 | 0.704 | 1.2× |

**关键发现**:
- 19/20模型精度显著超过召回(1.2×–7.2×)
- 商业模型未参与参考生成管道，但同样呈现cherry-picking
- GPT-5准确率最高(57.99%)，但仅恢复47.9%参考步骤
- **答案正确性 ≠ 推理透明度**

### Disordered Reasoning: No Model Preserves >60% Step Order

| Model | Match F1 | LIS Ratio | Ordered F1 |
|-------|----------|-----------|------------|
| GPT-5-mini | **0.773** | 0.560 | **0.670** |
| Qwen3-VL-32B | 0.718 | 0.581 | 0.617 |
| Gemini 2.5 Flash | 0.673 | 0.584 | 0.579 |

**Finding 4**: 无竞争模型(F1>0.6)能保持>60%匹配步骤的正确相对顺序。GPT-5-mini Ordered F1最高(0.670)，但LIS=0.560意味着**44%步骤顺序错误**。

### Causal Process Reward (CPR): Multiplicative Step-Level Alignment

**标准加性奖励的问题**:
```
R = w_f·R_fmt + w_a·R_acc + w_r·R_reason
```
→ 允许模型通过猜测最大化奖励，忽略推理质量。

**CPR因果过程奖励** (公式7):
```
R_CPR = { a_w + s_w·F1_step    if answer correct
        { s_w·F1_step·λ       otherwise (λ=0.3)
```
- 正确猜测但无推理 → 仅得a_w (无步骤奖励)
- 推理良好但答案错误 → 大幅折扣
- **乘性结构**确保两目标不可独立最大化

**CPR-Curriculum训练策略**:
- Phase 1: 仅格式+准确率奖励(建立稳定答案生成)
- Phase 2: 引入完整CPR奖励(更低学习率)
- 渐进难度调度: 从少步骤→多步骤示例
- **结果**: +32% Match F1 via GRPO (加性策略失败)

### OpenClaw Architecture Validation (Complete Mapping)

| CRYSTAL组件 | OpenClaw Equivalent | 验证度 |
|-------------|---------------------|--------|
| **Match F1 (步骤级F1)** | SKILL L1/L2验证 + Error Log记录 | ✅ 直接映射 |
| **Precision >> Recall (cherry-picking)** | Main Agent强制逐步验证需求 | ✅ 设计验证 |
| **Ordered Match F1 (顺序惩罚)** | AGENTS.md步骤顺序约束 | 🔄 待强化 |
| **Delphi四模型共识** | Evaluator多维度评分 + 人工门控 | ✅ 同构 |
| **CPR乘性奖励** | Skill成功率 × 答案正确性评估 | 🔄 设计启示 |
| **Semantic clustering (步骤聚合)** | Error Log语义聚类提取模式 | 🔄 待实现 |

### Critical Design Implications for OpenClaw

**1. Error Log需记录"预期步骤序列"**
> "Without observing intermediate steps, shortcuts become indistinguishable from genuine understanding"
- 当前Error Log记录实际执行路径
- 需扩展记录"预期步骤序列"以检测顺序错乱(disordered reasoning)

**2. SKILL验证即Match F1评估**
- L1 Schema验证 → Precision (步骤是否相关)
- L2输出验证 → Recall (步骤是否完整)
- 多步骤执行 → Ordered Match F1 (顺序是否正确)

**3. 禁止运行时自进化的CPR理论支撑**
- CPR-Curriculum的Phase 1/2分离 → 类似OpenClaw的编译期vs运行时分离
- 渐进难度调度 → SKILL难度分级验证

**4. Cherry-picking检测机制**
> "Models generating few steps achieve near-perfect step accuracy by generating fewer, safer steps"
- 检测指标: Steps数 << 参考平均(11.6) + Precision >> Recall
- 触发: 强制详细推理要求

### L3 Flags
- **#1581-A**: 实现Ordered Match F1评估(步骤顺序正确性)
- **#1581-B**: 设计CPR-style乘性奖励机制(成功率×正确性)
- **#1581-C**: 添加cherry-picking检测(高P低R模式识别)
- **#1581-D**: 研究Error Log语义聚类提取常见失败模式

**Relevant to**: bob (推理架构)、tech-lead (Skill评估框架)、evaluator (评分维度扩展)


---

## HB#1586 — AgentFuel: Domain-Specific Evaluation Generation Framework Exposes Stateful Query Blind Spot and Validates Customized Eval Design (2026-03-16)
**Source**: arXiv:2603.12483 [cs.AI] (CMU/Industry) — Direct Paper Tracking  
**Dataset**: https://huggingface.co/datasets/RockfishData/TimeSeriesAgentEvals  
**TL;DR**: **时序数据Agent评估框架**——6个主流Agent在stateful和incident-specific查询上系统性失败；两个表达性差距(领域定制数据集+领域特定查询)；AgentFuel支持领域专家快速生成定制化端到端功能测试

### Core Finding: Universal Failure on Stateful and Incident-Specific Queries

论文评估6个主流数据对话Agent(开源+闭源)在领域特定数据上的表现：
> "We evaluate 6 popular data analysis agents... and find that they fail on stateful and incident-specific queries."

**Agent覆盖**: Mixpanel Assistant, ThousandEyes Assistant, Elastic Assistant, Hextech, Databricks Genie, OpenAI Agent

**查询类型失败模式**:
| 查询类型 | 失败特征 | 示例 |
|----------|----------|------|
| **Stateful** | 无法理解跨会话状态累积 | "过去7天趋势对比上周" |
| **Incident-specific** | 无法识别异常模式并关联根因 | "为什么3月15日延迟突增?" |
| **Multi-hop reasoning** | 无法连接分散指标到综合洞察 | "用户体验下降的技术原因" |

### Two Expressivity Gaps in Existing Evaluations

论文识别出现有评估框架的两大结构性缺陷：

**Gap 1: Domain-Customized Datasets (领域定制数据集)**
- 现有基准使用通用时序数据 → 无法捕获领域特定模式
- IoT传感器数据 vs 电信网络指标 vs 产品分析事件 → 完全不同的异常特征

**Gap 2: Domain-Specific Query Types (领域特定查询类型)**
- 标准查询: "过去24小时平均值"
- 领域查询: "该异常是否符合我们上周定义的SLO违规模式?"

### AgentFuel Framework Architecture

AgentFuel帮助领域专家快速创建定制化评估的端到端功能测试：

**Input**: 领域专家提供的
- 数据schema和样本
- 领域特定查询模板
- 预期答案规范

**Output**: 可复现的评估数据集 + 测试脚本

**Key Design Principles**:
1. **Expressive**: 支持复杂时序模式(趋势、季节性、异常、关联)
2. **Customizable**: 领域专家可定义自定义查询类型和评判标准
3. **Actionable**: 暴露具体改进方向，不仅提供分数

### What This Means for OpenClaw

**1. Skill Evaluation Needs Domain-Specific Customization**
当前OpenClaw Skill评估以通用成功率为主。AgentFuel启示：
- 每个Skill需要领域定制的评估数据集
- 特别是stateful Skills(需要跨调用状态保持)
- Incident-specific Skills(需要异常检测+根因分析)

**2. Error Log作为Domain-Specific Eval Generator**
> "AgentFuel helps domain experts quickly create customized evals"

Error Log记录的实际失败案例可以反向生成评估用例：
- 提取真实失败模式 → 生成测试查询
- 领域专家标注预期结果 → 构建评估数据集
- 持续积累 → 形成领域特定测试套件

**3. Stateful Skill Design Validation**
论文发现的"stateful query failure"直接支撑OpenClaw的AGENTS.md设计：
- 禁止Agent运行时自进化 → 避免状态不一致
- Main Agent集中协调 → 统一状态管理
- Error Log append-only → 状态变更可追溯

### L3 Flags
- **#1586-A**: 为关键Skills设计领域定制评估数据集(超越通用成功率)
- **#1586-B**: 实现stateful Skill的跨调用状态一致性验证
- **#1586-C**: 研究从Error Log自动生成评估用例的可行性
- **#1586-D**: 设计incident-specific Skill的异常模式检测评估框架

**Relevant to**: bob (Skill评估架构)、tech-lead (领域定制评估)、scout (Agent基准测试)

---

## HB#1585 — CogSearch: Cognitive-Aligned Multi-Agent E-Commerce Framework with JD.com Industrial Validation and Complete OpenClaw Architecture Mapping (2026-03-16)
