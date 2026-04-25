# VAKRA: IBM's Enterprise Agent Benchmark — Reasoning, Tool Use, and Failure Modes

**来源**: Hugging Face Blog / IBM Research (Apr 15, 2026)  
**链接**: https://huggingface.co/blog/ibm-research/vakra-benchmark-analysis  
**类型**: Agent Benchmark / Enterprise AI  
**HB ID**: HB-260425-vakra-ibm-agent-benchmark

## 核心发现

VAKRA 是 IBM 发布的面向企业环境的 Agent 评估基准，与孤立技能测试不同，它测量跨 API 和文档的**组合推理能力**，使用完整执行轨迹评估 Agent 完成多步工作流的可靠性。

### 基准规模

- **8,000+ 本地托管 APIs**，覆盖 62 个领域
- 真实数据库支持的领域对齐文档集合
- 任务需 **3-7 步推理链**，结合结构化 API 交互与非结构化检索

### 四大能力维度

| 能力 | 实例数 | 领域数 | 描述 |
|------|--------|--------|------|
| **C1: API Chaining (BI APIs)** | 2,077 | 54 | 1-12 次工具调用链，使用 SLOT-BIRD/SEL-BIRD 集合 |
| **C2: Tool Selection (Dashboard APIs)** | 1,597 | 17 | 从平均 116 个工具中选择正确 API（最多 328 个） |
| **C3: Multi-Hop Reasoning** | 869 | 38 | 需 1-5 个逻辑跳跃提取并组合证据 |
| **C4: Multi-Hop + Multi-Source + Policy** | 644 | 41 | 最复杂：API + RAG 文档 + 多轮对话 + 工具使用策略约束 |

### 关键设计细节

**get_data 工具模式**:
```json
{
  "name": "get_data",
  "arguments": {"tool_universe_id": "xxx"},
  "label": "retrieved_data_1"
}
```
- 每个实例开始时必须调用，初始化数据源
- 返回轻量级预览（前几条记录 + schema），避免 MCP 传输大数据
- 服务端存储完整数据集，根据 tool_universe_id 暴露对应领域工具集

**OpenAI API 128 工具限制处理**:
- 平均 116 工具/领域，最多 328 个
- 需实现 tool shortlisting 机制（基线用简单 shortlister）

**C4 策略约束示例**:
```
If user's query pertains to Technology & Software about codebases,
software platforms... make sure you try answering by only using 
document retrievers. Do not use other types of tools.
```

### 失败模式分析 (Failure Modes)

IBM 观察到当前模型在 VAKRA 上表现**普遍较差**，主要失败模式：

1. **工具选择错误**: 在大量工具中无法识别正确 API（C2 挑战）
2. **多跳推理断裂**: 无法正确连接跨步骤的证据（C3/C4）
3. **策略违反**: 无视工具使用约束，调用禁止的数据源（C4）
4. **上下文丢失**: 多轮对话中丢失历史上下文（C4 多轮）
5. **数据源污染**: 无法在 API 和 RAG 之间正确路由查询（C4 多源）

### Leaderboard

- 数据集: https://huggingface.co/datasets/ibm-research/VAKRA
- 排行榜: https://ibm-research-vakra.hf.space/
- GitHub: https://github.com/IBM/vakra

## 对 OpenClaw 的意义

- ✅ **企业级 Agent 评估参考**: VAKRA 的 4 层能力设计可作为 Gym 场景设计参考
- ✅ **Tool shortlisting 必要性**: 验证大规模工具集需要动态筛选机制（如 Tool Attention 的 ISO score）
- ✅ **策略约束层**: GROUNDING.md 硬约束概念可扩展到工具使用策略
- ⚠️ **MCP 大数据传输问题**: get_data 的轻量级预览模式值得借鉴——避免在协议层传输大数据集
- ⚠️ **多源推理能力缺口**: 当前 OpenClaw 缺乏显式的 API+RAG 混合查询能力

## 技术对标

| 特性 | VAKRA | OpenClaw 现状 |
|------|-------|---------------|
| API 数量 | 8,000+ (62 领域) | 数十个 Skills |
| 工具选择 | 平均 116/域，需 shortlisting | 简单 name matching |
| 多跳推理 | 1-5 跳，显式测试 | 依赖模型隐式推理 |
| 策略约束 | 明文工具使用策略 | AGENTS.md soft guidelines |
| 数据源混合 | API + RAG (C4) | 主要代码/文件工具 |

## 关键洞察

> "Models perform poorly on VAKRA" — 当前 Agent 在企业级复杂工作流上仍有巨大提升空间。

组合推理（Compositional Reasoning）是 Agent 从 demo 走向 production 的核心瓶颈。

---
*Scraped by amy-kimi on 2026-04-25*
