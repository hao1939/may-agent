# TopoBench: Benchmarking LLMs on Hard Topological Reasoning

**Source:** arXiv:2603.12133v1  
**Authors:** Mayug Maniparambil, Nils Hoehing, Janak Kapuriya, Arjun Karuvally, Ellen Rushe, Anthony Ventresque, Noel O'Connor, Fergal Reid  
**Institutions:** Intercom Research, UCD, University of Galway, Salk Institute, DCU, Trinity College Dublin  
**Status:** Accepted, ICLR 2026 Workshop on Logical Reasoning of LLMs  
**GitHub:** https://github.com/mayug/topobench-benchmark  
**Archived:** 2026-03-14  
**SIG:** 1773450605:f508608c

---

## Core Contribution

TopoBench: 评估LLM在**全局空间不变量**推理能力的基准测试，包含六类拓扑谜题、三难度等级、750条推理轨迹标注。

### 六类拓扑谜题家族

| 谜题 | 空间约束 | Hard表现 |
|------|---------|---------|
| Flow Free | 路径连通性 | 极低 |
| Bridges | 网络连通性 | 44% (最好) |
| Loopy | 环路闭合 | **接近0%** |
| Galaxies | 旋转对称 | **接近0%** |
| Undead | 反射与可视性 | 52% (GPT-5) |
| Pattern | 跨轴连续性 | 中等 |

**核心发现**: 需要验证单一全局不变量的谜题(Loopy/Galaxies)比可分解为半局部检查的谜题更难。

---

## Performance Results

### Frontier Model Performance

| 模型 | Params | Easy | Medium | Hard |
|------|--------|------|--------|------|
| GPT-5-mini-high | - | 71% | 44% | **24%** |
| Gemini-3-Flash | - | 60% | 35% | 9% |
| DeepSeek V3.2 | 671B(37B) | 58% | 37% | 10% |
| Qwen3-235B | 235B(22B) | 31% | 12% | - |

- 从easy到hard性能**急剧下降**
- 显示**尖锐的能力边界**而非平滑扩展
- 人类专家可100%解决easy难度

---

## Error Taxonomy: 两阶段诊断

### 七类错误模式

| 缩写 | 错误类型 | 观察频率 | 因果影响 |
|------|---------|---------|---------|
| **RR** | Repeated Reasoning | 33% | ❌ 无害 |
| **PC** | Premature Commitment | 32% | ⚠️ -11pp |
| **RD** | Representation Drift | 33% | 中等 |
| **STF** | State-Tracking Failure | 18% | 中高 |
| **CF** | Constraint Forgetting | **4%** | 🚨 **最高** |
| **ES** | Explicit Surrender | 76% | 症状 |
| **IO** | Incomplete Output | 12% | 症状 |

**关键洞察**: **频率≠因果影响**
- Constraint Forgetting罕见(2-7%)但最具破坏性
- Repeated Reasoning常见但**无因果效应**(搜索的良性效应)

---

## Intervention Experiments

### 三种缓解策略效果

**1. Cell-Aligned Representation**
- 每行token数相等
- 多数谜题准确率提升

**2. Tool-Augmented Constraint Checking**

| 条件 | Bridges Hard |
|------|-------------|
| 基线 | 40% |
| + ASCII网格工具 | ❌ 下降 |
| + 结构化约束摘要 | ✅ +10% |

**核心发现**:
> "瓶颈在于从空间表征中提取结构化约束信息，而非推理本身。"

**3. Prompt-Level Planning/Backtracking**
- 结果: **无显著改善**
- 含义: 此类行为无法通过prompting可靠激发

---

## OpenClaw Architecture Mapping

| TopoBench Component | OpenClaw Equivalent | Insight |
|--------------------|---------------------|---------|
| State-Tracking Failure | Error Log本地检查 | 防止累积漂移 |
| Constraint Forgetting | 规则DSL显式编码 | 低频率高损害 |
| Structured Constraint Tool | Error Log结构化输出 | 直接提供约束摘要 |
| Premature Commitment | Skill检查点机制 | 分解为可验证子目标 |
| Cell-Aligned Tokenization | 统一输出格式 | 改善解析准确性 |

### 诊断方法论可借鉴

TopoBench的两阶段pipeline可应用于Error Log分析:
1. LLM-as-judge标注错误类型频率
2. 干预实验验证因果影响
3. 优先修复高因果影响错误

---

## Key Insights for OpenClaw

1. **错误频率不是修复优先级指标** — 需因果验证
2. **结构化约束表示 > 原始轨迹** — Error Log设计验证
3. **过早承诺是主要损害源** — Skill需内置检查点
4. **全局不变量验证是硬边界** — 复杂任务需分解
5. **Prompt-level backtracking无效** — 不能依赖自发回溯

---

## L3 FLAGS

| ID | Flag | Priority |
|----|------|----------|
| #885 | Frequency≠Causality: 错误频率≠因果影响 | P2 |
| #886 | Constraint-Extraction-Bottleneck | P1 |
| #887 | Premature-Commitment机制 | P2 |
| #888 | Structured-State-Tool设计 | P2 |
| #889 | Global-Invariant-Hardness | P2 |
| #890 | Cell-Aligned-Tokenization | P3 |

---

**Relevant to:** Bob (全局约束推理限制), tech-lead (Error Log设计), scout (诊断方法论)

**Paper Link:** https://arxiv.org/abs/2603.12133  
**Code:** https://github.com/mayug/topobench-benchmark

[SIG: 1773450605]
