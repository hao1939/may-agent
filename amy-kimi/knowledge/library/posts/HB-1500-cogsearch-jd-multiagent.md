# HB#1500 — CogSearch: JD.com工业级四Agent架构

**Source**: arXiv:2603.11927 [cs.MA] (12 Mar 2026)  
**Authors**: Zhouwei Zhai et al. (JD.com)  
**Institution**: JD.com (中国最大的自营电商平台之一)

---

## 核心贡献

CogSearch是一个**认知对齐的多Agent框架**，将电商搜索从"被动检索-排序"升级为"主动决策支持系统"。已在JD.com全量部署，通过大规模A/B测试验证。

---

## 四Agent架构

| Agent | 职责 | OpenClaw映射 |
|-------|------|--------------|
| **Planner** | 意图理解、任务规划、生成Task Graph (DAG) | Main Agent (L3战略决策) |
| **Executor** | 多源信息获取(站内商品/网页/工具调用) | Sub-agents + Skills |
| **Guider** | 主动决策引导、动态筛选、购买策略 | AGENTS.md (persona约束) |
| **Decider** | 综合推理、结构化购买建议 | 验证/输出层 |
| **Memory System** | 上下文存储、Agent状态、Task Graph | Context Engine |

---

## 关键技术细节

### 1. Task Graph (DAG)
- 形式化: 𝒢=(𝒱,ℰ)，顶点为原子认知任务，边为语义依赖
- 动作空间三维定义:
  - **ProductSearch (T_prod)**: 站内商品检索
  - **WebSearch (T_web)**: 开放域知识获取
  - **ToolInvocation (T_tool)**: MCP协议工具调用

### 2. Executor多层检索架构
- **关键词-向量融合**: 平台API(词汇召回) + 对比学习语义嵌入
- **多源增强**: ProductAttr + ReviewSum子Agent聚合属性
- **网页搜索三阶段**: Expand(查询扩展) → Retrieve(并行检索) → Filter(多标准过滤)
  - 评分函数: Score(d) = α·Rel(d,q) + β·Auth(d) + γ·Fresh(d)

### 3. Guider认知引导机制
- **CGC机制**: Clarify-Guide-Contextualize
- **动态认知面生成**: 基于信息增益选择最具区分性的属性
  - a* = argmax InfoGain(a|ℐ,𝒮_u,𝒞)
- **个性化购买策略**: Expert Anchoring + Trade-off Analysis + Scenario Mapping

### 4. Decider综合决策
基于Simon三阶段决策模型(Intelligence-Design-Choice)和MCDM理论:
- 上下文聚合: 𝒮_ctx = Φ(𝒫, 𝒲, ℋ, 𝒰, 𝒞)
- 输出结构化购买建议(非仅概率分数)

---

## 工业验证结果 (JD.com A/B测试)

| 指标 | 结果 | 意义 |
|------|------|------|
| 决策成本 | -5% | 用户认知负荷降低 |
| 整体UCVR | +0.41% | 转化率提升 |
| 重决策查询UCVR | **+30%** | 复杂场景效果显著 |

---

## 与OpenClaw的映射验证

| CogSearch | OpenClaw | 验证点 |
|-----------|----------|--------|
| Planner → Task Graph | Main Agent → 子任务分配 | L3战略层设计一致 |
| Executor → MCP工具 | Skills → 工具调用 | Skill作为能力单元 |
| Memory System作为hub | Context Engine + AGENTS.md | 中心化记忆架构 |
| Guider主动引导 | AGENTS.md被动注入 | **差异**: 主动vs被动 |
| DAG依赖管理 | Error Log状态追踪 | 结构化执行流程 |

---

## 关键洞察

1. **认知对齐 > relevance-centric**: 从"返回相关商品"到"协助完整决策过程"
2. **四Agent分工明确**: 每个Agent解决特定认知问题，非简单并行
3. **WebSearch作为一等公民**: 跨平台信息融合是差异化关键
4. **MCP工具集成**: 通过MCP动态调用外部API(天气、物流等)

---

## 差异与启示

| 维度 | CogSearch | OpenClaw |
|------|-----------|----------|
| 主动性 | Guider主动生成建议 | AGENTS.md被动约束 |
| 交互模式 | 对话式搜索 | 任务执行 |
| 记忆更新 | 动态记忆系统 | 文件化AGENTS.md |
| 领域 | 电商搜索 | 通用Agent系统 |

**启示**: OpenClaw可考虑在特定场景(如交互式任务)引入"主动引导"模式，但需权衡P109边界控制。

---

**HB#1500** | Archived: 2026-03-15
