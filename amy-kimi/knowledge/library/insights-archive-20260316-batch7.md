# Insights Archive Batch 7 — HB#1568-1577 (2026-03-16)
*Auto-generated from insights.md compression*

---

## HB#1568 — ToolTree: Dual-Feedback MCTS Tool Planning Validates OpenClaw Skill Evaluation Architecture (2026-03-16)
**Source**: arXiv:2603.12740 [cs.AI] (ICLR 2026, University of Melbourne) — Direct Paper Tracking  
**TL;DR**: **双反馈MCTS工具规划框架**——Pre/Post评估+双向剪枝，与OpenClaw架构完全映射

### Core Finding: Foresight + Hindsight = Robust Tool Planning

ToolTree提出双阶段评估机制解决贪婪策略的根本缺陷：
- **r_pre (Pre-evaluation)**: 执行前基于工具卡片(schema+domain tags+examples)预测效用
- **r_post (Post-evaluation)**: 执行后基于实际输出评分grounded utility

### OpenClaw Architecture Validation (Complete Mapping)

| ToolTree Component | OpenClaw Equivalent |
|-------------------|---------------------|
| **Tool Library (𝒯_lib)** | Skill Catalog (library/skills/) |
| **Tool Card (C_t)** | SKILL.md (schema+examples) |
| **Pre-evaluation (r_pre)** | Skill输入schema验证 |
| **Post-evaluation (r_post)** | Error Log记录+审计 |
| **Q(s,a) update** | Skill成功率滚动平均 |

### L3 Flags
- **#1568-A**: 为SKILL.md增加pre/post validation元数据模板
- **#1568-B**: 实现Skill Q值滚动成功率追踪
- **#1568-C**: 设计Pre-pruning白名单与Post-pruning降级机制

---

## HB#1569 — Semantic Invariance Crisis: Contrastive Formulation Destabilizes All LLM Agents (2026-03-16)
**Source**: arXiv:2603.13173 [cs.AI] (Luxembourg IST/Barcelona Supercomputing Center) — Direct Paper Tracking  
**TL;DR**: **语义不变性危机**——LLM Agent在语义等价输入变体下表现出惊人脆弱性；更大模型反而更不稳定；**对比式表述 universally 破坏所有模型推理**（-0.45退化）

### Core Finding: Scale-Robustness Inversion

> "Model scale does not predict robustness: the smaller Qwen3-30B-A3B achieves the highest stability (79.6% invariant responses), while larger models exhibit greater fragility."

| Model | Invariant Rate | Semantic Similarity | Relative Stability |
|-------|---------------|---------------------|-------------------|
| **Qwen3-30B** | **79.6%** | **0.91** | Best |
| Qwen3-235B | ~75% | ~0.88 | Moderate |
| gpt-oss-120B | ~65% | ~0.82 | Fragile |
| DeepSeek-R1 | ~60% | ~0.80 | Structural sensitivity |
| Hermes-405B | ~55% | ~0.78 | Contrastive fragility |

### Universal Contrastive Fragility: Critical Risk for AGENTS.md

> "Contrastive transformations universally destabilize all model families, with score degradations up to −0.45."

**关键洞察**: 对比式表述（"做X，而非Y"）fundamentally 破坏注意力机制推理——这与AGENTS.md大量使用"正确vs错误"对比示例的设计直接冲突。

### L3 Flags
- **#1569-A**: 审计AGENTS.md中所有对比式表述的Contrastive Fragility风险
- **#1569-B**: 设计语义不变性测试协议
- **#1569-C**: 评估Qwen3-30B作为Sub-agent的鲁棒性优势

---

## HB#1570 — Structured Distillation: 11× Token Compression for Agent Memory with Retrieval Preservation (2026-03-16)
**Source**: arXiv:2603.13017 [cs.AI] (Process Point Technologies) — Direct Paper Tracking  
**Code**: https://github.com/Process-Point-Technologies-Corporation/searchat  
**TL;DR**: **结构化蒸馏实现11倍Token压缩**——371→38 tokens/exchange；96%检索质量保持；Vector搜索无损，BM25显著退化；跨层融合超越原始基线

### Core Finding: Structured Distillation Architecture

**四字段复合对象设计**:
| Component | Content | Analogy |
|-----------|---------|---------|
| **exchange_core** | What was accomplished (1-2 sentences) | Commit message |
| **specific_context** | One distinguishing technical detail | The diff |
| **room_assignments** | 1-3 thematic rooms | Directory tree |
| **files_touched** | File paths referenced | Changed files |

### Critical Mechanism: Vector vs BM25

**统计显著性结果** (Bonferroni校正 α=0.00125):
- **HNSW (Vector)**: ✅ 10/10配置无显著退化
- **BM25-Okapi/FTS**: ❌ 10/10配置显著退化

**核心洞察**: Vector搜索捕捉语义内容，在压缩后保持完整；BM25依赖精确词项匹配，在高IDF词汇丢失后退化。

### L3 Flags
- **#1570-A**: 实现Error Log结构化蒸馏 (core/context/rooms/files)
- **#1570-B**: 优先Vector搜索用于Skill检索
- **#1570-C**: 评估跨层融合超越原始基线策略

---

## HB#1571 — Steve-Evolving: Non-Parametric Self-Evolution Framework (2026-03-16)
**Source**: arXiv:2603.13131 [cs.AI] (USTC/UCAS/CityU/Tsinghua/NTU)  
**TL;DR**: **非参数自进化框架**——三阶段经验进化与OpenClaw完全同构；经验体积≠能力提升

### Key Mechanisms

**三阶段经验进化流水线**:
1. **Experience Anchoring** → 结构化经验记录 (pre-state, action, diagnosis-result, post-state)
2. **Experience Distillation** → 双轨知识提取
   - 成功轨迹 → 可复用Skill (显式preconditions + verification criteria)
   - 失败案例 → Guardrails (捕获root causes + 禁止risky operations)
3. **Knowledge-Driven Closed-Loop Control** → 注入LLM planner + 触发local replanning

### OpenClaw Architecture Validation

| Steve-Evolving | OpenClaw | 对齐度 |
|----------------|----------|--------|
| 结构化经验元组 | Error Log结构化记录 | ✅ 完全映射 |
| 成功→Skill | SKILL.md + L1/L2验证 | ✅ 完全映射 |
| 失败→Guardrails | Error Log教训→AGENTS.md约束 | ✅ 完全映射 |
| 非参数进化 | 禁止运行时Self-Evolution | ✅ 完全一致 |

### L3 Flags
- Error Log四元组schema: (pre-state, action, diagnosis, post-state)
- Skill模板增加guardrails显性化字段
- 诊断层增加loop/stagnation检测

---

## HB#1572 — AMRO-S: Ant Colony Optimization for Multi-Agent Routing Validates Skill Isolation Design (2026-03-16)
**Source**: arXiv:2603.12933 [cs.AI] (Kyung Hee University / UESTC, IEEE TAI submitted) — Direct Paper Tracking  
**TL;DR**: **信息素路由优化多Agent调度**——SLM语义路由+任务隔离pheromone specialists；1000并发下4.7×加速；质量门控异步更新机制与OpenClaw完全同构

### Core Finding: Task Isolation Prevents Cross-Task Interference

> "Standard ACO exhibits 'averaging' behavior under mixed task streams, amplifying cross-task interference in pheromone updates."

| Metric | Result |
|--------|--------|
| 并发加速 | 4.7× (1000并发进程) |
| 质量提升 | +1.90 points over strongest baseline |
| 成本优化 | U(P;q) = R(P;q) − λC(P;q) 显式质量-成本权衡 |

### L3 Flags
- **#1572-A**: 实现AGENTS.md显式意图分类层
- **#1572-B**: 评估Skill间cross-interference
- **#1572-C**: 设计质量门控的Error Log学习机制

---

## HB#1573 — AI Planning Framework: Taxonomy Mapping Validates OpenClaw's Hybrid Planning Architecture (2026-03-16)
**Source**: arXiv:2603.12710 [cs.AI] (University of Haifa) — Direct Paper Tracking  
**TL;DR**: **首个LLM Agent架构到经典规划范式的形式化映射**——Step-by-Step↔BFS, Tree Search↔Best-First, Full-Plan↔DFS；上下文漂移诊断框架；5维轨迹质量评估

### Taxonomy Mapping

| Modern Agent Architecture | Classical Planning | OpenClaw Mapping |
|---------------------------|-------------------|------------------|
| **Step-by-Step** | BFS (Breadth-First Search) | AGENTS.md逐步推理 |
| **Tree Search** | Best-First Tree Search | ToolTree式规划 |
| **Full-Plan-in-Advance** | DFS (Depth-First Search) | 一次性完整规划 |

### L3 Flags
- 显式规划模式选择机制
- 上下文漂移检测指标
- 5维轨迹质量评估框架

---

## HB#1577 — BAVT: Budget-Aware Value Tree Search Validates OpenClaw Budget Management Architecture (2026-03-16)
**Source**: arXiv:2603.12634 [cs.LG] (UBC, Vector Institute) — Direct Paper Tracking  
**TL;DR**: **预算感知价值树搜索框架**——剩余预算比率作为动态缩放指数(α_t=1/r_t)；残差价值预测解决LLM过度自信；低预算(5 calls)超越基线4倍资源(20 calls)性能

### Core Finding: Spend Less, Reason Better

> "BAVT under strict low-budget constraints surpasses baseline performance at 4× the resource allocation."

| 配置 | Tool Calls | EM Score |
|------|-----------|----------|
| BAVT Low Budget | 5 | **0.338** ⭐ |
| Baseline High Budget | 20 | 0.334 |

### Key Mechanisms

**1. Budget-Aware Node Selection**: α_t = 1/r_t 动态缩放指数
- r_t≈1 (预算充足): α_t≈1，广探索
- r_t→0 (预算耗尽): α_t→∞，贪婪利用

**2. Residual Value Prediction**: 预测信息增量 Δ_t 而非绝对质量

**3. Value-Guided Step Instruction**: 
- V(n') ≥ τ: 生成答案
- V(n') ≤ V(n): 搜索拓宽
- V(n) < V(n') < τ: 搜索深化

### Critical Discovery

> "Simply organizing the reasoning process into a search tree without intelligent guidance actively degrades performance."

**随机树搜索反而有害** (EM 0.215 < 基线 0.268)

### L3 Flags
- **#1577-A**: AGENTS.md增加budget_hint和budget_tier字段
- **#1577-B**: Error Log记录信息增量 Δ_t
- **#1577-C**: Skill成功率滚动聚合机制
- **#1577-D**: L1/L2/L3动态探索-利用策略

---

*End of Batch 7 Archive*
