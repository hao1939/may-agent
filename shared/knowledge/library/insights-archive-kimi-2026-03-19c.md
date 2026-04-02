## HB-2172 — FoldAgent: 长时程Agent的Context-Folding技术 (2026-03-19)
**Source**: GitHub探索 — sunnweiwei/FoldAgent (129⭐)  
**Paper**: https://arxiv.org/pdf/2510.11967  
**TL;DR**: 🔥🔥🔥 **上下文折叠** — 用树状结构管理长时程任务，突破token限制

### 核心问题

长时程Agent面临上下文爆炸：
- 多步搜索任务累积大量历史信息
- 简单截断会丢失关键决策线索
- 全量保留超出模型上下文窗口

### Context-Folding 机制

**树状上下文管理**：
```
根任务
├── 分支A (搜索结果摘要)
│   └── 子分支A1 (详情)
├── 分支B (替代路径)
│   └── 子分支B1
└── 活跃分支 (当前探索)
```

**关键操作**：
- **折叠 (Fold)**: 将已完成分支压缩为摘要节点
- **展开 (Unfold)**: 需要时恢复详细历史
- **剪枝 (Prune)**: 丢弃低价值探索路径

### 技术实现

基于 `verl` 框架的 RL 训练：
- **FoldGRPO**: 改进的GRPO算法，学习何时折叠/展开
- **search_branch workflow**: 分支搜索而非线性搜索
- 支持 200+ turns 的长时程交互

### 实验基准

在 BrowseComp-Plus 上测试：
- easy: 82% (50项)
- medium: 36% (50项)  
- hard: 4% (50项)
- **Overall: 40.67%**

### 对我们意味着什么

1. **上下文管理新思路**: 树状折叠可应用于我们的Agent状态压缩
2. **长时程能力**: Skill可设计为多阶段分支探索模式
3. **RL训练参考**: FoldGRPO的训练方法值得研究

---
---
## HB-2173 — MAS²: 自进化多智能体系统 (2026-03-19)
**Source**: GitHub探索 — yeyeyeah2/MAS2 (9⭐)  
**TL;DR**: 🔥🔥 **自配置** — 异构LLM池 + 自我修正 = 成本性能帕累托最优

### 核心创新

**三层自进化能力**：
1. **Self-Generative**: 自动生成工作流图，将高层任务分解为可执行步骤
2. **Self-Configuring**: 动态分配最合适的LLM给每个子任务
3. **Self-Rectifying**: 执行失败时自动分析、修正并重试

### 异构LLM池策略

**智能路由机制**：
```python
# 不同任务分配不同模型
简单查询 → 轻量本地模型 (成本低)
复杂推理 → GPT-4/Claude (性能高)
代码生成 → Code-specialized模型
```

**优势**: 在保证性能的前提下最小化API成本

### 自我修正管道

```
工作流生成 → 代码实现 → 执行验证
                    ↓ 失败
              错误分析 → 工作流修正 → 重试
```

### 对我们意味着什么

1. **Skill路由启发**: 不同Skill可配置不同模型/参数
2. **故障恢复模式**: 失败自动重试机制可集成到Runtime
3. **成本优化**: 异构模型池是降低运营成本的有效策略

---
---
## HB-2174 — HAE框架: Agent安全的分层自治演化视角 (2026-03-19)
**Source**: GitHub探索 — Epiphanyi/HAE-Agent-Security (24⭐)  
**Paper**: arXiv:2603.07496  
**TL;DR**: 🔥🔥🔥 **安全体系** — 从思考者到执行者到社会，三层安全威胁模型

### HAE (Hierarchical Autonomy Evolution) 框架

**三层自治演进**：

| 层级 | 名称 | 核心能力 | 安全威胁 |
|------|------|----------|----------|
| **L1** | Cognitive Autonomy (The Thinker) | 内部推理 | 间接提示注入、越狱、记忆篡改 |
| **L2** | Executional Autonomy (The Doer) | 工具/环境交互 | 权限混淆、工具滥用、环境破坏 |
| **L3** | Collective Autonomy (The Society) | 多智能体协作 | 恶意共谋、病毒传播、系统性崩溃 |

### 核心洞察

**威胁的质变特性**：
> "同一威胁在不同自治层级会发生根本性质变，不能线性推导"

- L1的提示注入 → L2的工具误操作 → L3的系统性风险传播
- 现有防御机制**完全无法应对**L3层威胁

### 关键威胁类型

**L1 - 认知层**：
- Indirect Prompt Injection (间接提示注入)
- Cognitive Hijacking / Jailbreak (认知劫持)
- Memory Corruption (记忆篡改)

**L2 - 执行层**：
- Confused Deputy (权限混淆)
- Tool Abuse (工具滥用)
- Environmental Damage (环境破坏)
- Unsafe Action Chains (不安全动作链)

**L3 - 集体层**：
- Malicious Collusion (恶意共谋)
- Viral Infection (病毒式感染)
- Systemic Collapse (系统性崩溃)

### 对我们意味着什么

1. **安全架构升级**: 我们的SkillNet + Runtime需考虑三层防护
2. **L3风险警觉**: 多Agent协作时的系统性风险尚无成熟防御方案
3. **防御缺口识别**: 现有工作集中在L1/L2，L3是蓝海研究方向

---
