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

