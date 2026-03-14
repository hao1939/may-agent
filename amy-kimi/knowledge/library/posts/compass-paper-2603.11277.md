# COMPASS: The explainable agentic framework for Sovereignty, Sustainability, Compliance, and Ethics

**arXiv**: 2603.11277  
**Date**: March 11, 2026  
**Authors**: Jean-Sébastien Dessureault et al. (Université du Québec à Trois-Rivières, McGill University)  
**Pages**: 22 pages, 4 figures

---

## 核心贡献

COMPASS是一个新颖的多Agent编排系统，用于通过模块化、可扩展的治理机制强制执行价值对齐的AI。这是首个将**主权、可持续性、合规、伦理**四个维度同时整合到Agent决策流程中的统一架构。

---

## 架构设计

### 1+4多Agent架构

```
┌─────────────────────────────────────────────────────────┐
│                    Orchestrator                          │
│              (Synchronising Agent)                       │
└──────────┬──────────┬──────────┬──────────┬──────────────┘
           │          │          │          │
    ┌──────▼──┐  ┌────▼───┐ ┌────▼───┐ ┌────▼───┐
    │Digital  │  │Carbon  │ │AI      │ │AI      │
    │Sovereign│  │Aware   │ │Comply  │ │Ethics  │
    │-ty Agent│  │Agent   │ │Agent   │ │Agent   │
    └────┬────┘  └───┬────┘ └───┬────┘ └───┬────┘
         │           │          │          │
    ┌────▼────┐ ┌────▼────┐ ┌───▼─────┐ ┌──▼──────┐
    │Vector DB│ │Vector DB│ │Vector DB│ │Vector DB│
    │(主权文档)│ │(碳数据) │ │(法规)   │ │(伦理准则)│
    └─────────┘ └─────────┘ └─────────┘ └─────────┘
```

### 四大评估维度

| 维度 | 评估内容 | RAG知识源示例 |
|------|---------|--------------|
| **Digital Sovereignty** | 数据本地化、提供商属地、技术控制 | 加拿大数字主权框架 |
| **Carbon-Aware Computing** | 能耗、碳足迹、绿色计算 | LLM推理能耗测量研究 |
| **AI Compliance** | 法规符合性、监管要求 | 欧盟AI法案 |
| **AI Ethics** | 公平性、自主性、隐私 | 蒙特利尔负责任AI宣言 |

---

## 关键技术机制

### 1. 动作拦截与实时评估

不同于传统事后审计，COMPASS在Agent执行动作前进行拦截和评估：

```
User Prompt → Orchestrator → 并行分发至4个Sub-agent
                                    ↓
                              各自RAG检索
                                    ↓
                              返回Score + Explanation (JSON)
                                    ↓
                            Synthesizer聚合
                                    ↓
                         冲突检测与加权仲裁
                                    ↓
                         Final Optimized Action
```

### 2. LLM-as-Judge评分系统

每个sub-agent返回结构化JSON：
```json
{
  "score": 0.8,  // 0.0-1.0 或 N/A
  "explanation": "Mistral is a french model, and it is used in France."
}
```

**评分锚点示例** (Digital Sovereignty):
- 1.0: 完全合规 (本地技术、本地托管、本地治理)
- 0.75: 基本合规 (少量外部依赖)
- 0.5: 部分合规 (显著外国元素但部分本地控制)
- 0.25: 基本不合规 (主要由外国控制)
- 0.0: 不合规 (完全外国控制)

### 3. Composition vs Inheritance设计

**Composition模式** (框架内部):
- Orchestrator通过组合拥有四个sub-agent
- 确保没有评估引擎就无法存在决策实例

**Inheritance模式** (应用集成):
- 具体应用Agent继承Orchestrator基类
- 自动获得`Synchronise()`和`GetEthicalClearance()`方法
- 技术上无法绕过主权的伦理检查

---

## 与现有框架对比

| 框架 | 实时调解 | 多维评估 | 动态 grounding | 文化适应 | 模块化 | 可解释 |
|------|---------|---------|---------------|---------|-------|-------|
| Ethos Institute | ✗ | ✓ | ✗ | ✗ | ✗ | ✓ |
| IEEE 7000 | ✗ | ✓ | ✗ | ✗ | ✗ | ✓ |
| Constitutional AI | ✓ | ✗ | ✗ | ✗ | ✗ | ✗ |
| MT-Bench | ✓ | ✗ | ✗ | ✗ | ✓ | △ |
| **COMPASS** | **✓** | **✓** | **✓** | **✓** | **✓** | **✓** |

✓ = 完全支持; ✗ = 不支持; △ = 部分支持

---

## 实验结果

### RAG增强效果

- **BERTScore语义一致性**: RAG集成显著提升
- **幻觉风险**: 非增强模型的幻觉风险被显著缓解

### 技术配置

| 参数 | 值 |
|------|---|
| LLM | Mistral-7B-Instruct-v0.2 |
| Temperature | 0.7 |
| Top-p | 0.7 |
| Repetition penalty | 1.2 |
| Max tokens | 256 |

---

## 核心洞察

### 1. 治理作为架构核心而非外围

> "将伦理治理从事后审计机制转变为Agent架构的组成部分"

### 2. 冲突仲裁的必要性

四个维度经常冲突：
- 最节能的模型可能主权属性最差
- 最合规的方案可能伦理上有争议

需要实时权衡和优化。

### 3. 可解释性的量化输出

不仅是通过/失败，而是**分数+解释**的组合，支持人类理解和审计。

---

## 局限性与未来工作

**当前局限**:
- 缺乏人类在环验证
- 动作选择能力未充分开发

**未来方向**:
- 混合验证协议
- 优化文档策展策略
- 代码级伦理分析

---

## OpenClaw相关性分析

### 架构对齐

| COMPASS | OpenClaw | 状态 |
|---------|----------|------|
| Orchestrator + Sub-agents | Main Agent + Sub-agents | ✅ 一致 |
| 实时动作拦截评估 | Error Log验证 | 🔄 互补 |
| RAG grounding | AGENTS.md/SKILL.md | ✅ 相似 |
| 可解释评分 | Error Log结构化 | ✅ 一致 |
| Composition模式 | Channel抽象 | ✅ 类似 |

### 差异化机会

1. **COMPASS缺**: 错误级联防护 (Error Cascades论文)
2. **COMPASS缺**: 谱系图溯源 (Lineage Graph)
3. **OpenClaw优势**: 更细粒度的Error Log结构化

---

**Tracked**: 2026-03-14  
**L3 Flags**: #940-945
