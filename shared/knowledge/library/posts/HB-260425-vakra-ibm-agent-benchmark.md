# HB-260425: VAKRA — IBM Enterprise Agent Evaluation Benchmark

**Source**: Hugging Face Blog / IBM Research (Apr 15, 2026)  
**Authors**: Ankita Naik, Danish, Ben, Anupama Murthi, Praveen  
**URL**: https://huggingface.co/blog/ibm-research/vakra-benchmark-analysis  
**Type**: Benchmark / Enterprise Evaluation  
**Rating**: ★★★★★

## Core Insight

> "Models perform poorly on VAKRA — current agents have enormous room for improvement on enterprise complex workflows."

VAKRA不是测试孤立技能，而是测量**组合推理** (compositional reasoning) — 跨越API和文档的完整执行轨迹评估。

## Benchmark Scope

| Metric | Value |
|--------|-------|
| APIs | 8,000+ |
| Domains | 62个领域 |
| Reasoning Steps | 3-7步推理链 |
| Data Backend | 真实数据库 |

## Four Capability Dimensions

### C1: API Chaining (Business Intelligence APIs)
- **测试内容**: 1-12次工具调用链
- **数据源**: SLOT-BIRD & SEL-BIRD collections
- **特点**: 每个domain限制在一个工具集合，任务涉及链式调用

### C2: Tool Selection
- **测试内容**: 平均116个工具/domain（最多328个）
- **挑战**: 大规模工具集中的精确选择

### C3: Multi-Hop Reasoning
- **测试内容**: 1-5个逻辑跳跃
- **挑战**: 多步骤推理的连贯性

### C4: Multi-Source + Policy
- **测试内容**: API + RAG + 多轮对话 + 工具使用策略约束
- **挑战**: 复杂约束下的协调执行

## Key Design: get_data Pattern

```json
{
  "name": "get_data",
  "arguments": {"tool_universe_id": "xxx"},
  "label": "retrieved_data_1"
}
```

**创新点**:
- 返回轻量级数据预览（避免MCP大数据传输）
- 完整数据集服务器端存储
- 根据tool_universe_id配置MCP服务器暴露的工具集
- 对齐domain-specific数据库

**对MCP Tax的启示**: 避免在协议层传输大量数据，改用预览+服务端存储模式。

## Failure Modes Analysis

IBM Research识别的主要失败模式：

1. **工具选择错误** (Tool Selection Errors)
   - 在116-328个工具中选择错误
   - 缺乏有效的工具筛选机制

2. **多跳推理断裂** (Multi-Hop Reasoning Breakdown)
   - 1-5步推理链中的某一步失败
   - 错误传播导致最终失败

3. **策略违反** (Policy Violations)
   - 违反工具使用策略约束
   - 安全/合规性问题

4. **上下文丢失** (Context Loss)
   - 多轮对话中丢失关键信息
   - 长序列中的注意力分散

5. **数据源污染** (Data Source Contamination)
   - 混合查询时的数据混淆
   - API与RAG结果冲突

## 对 OpenClaw 的意义

- ✅ Gym场景设计参考：4层能力框架
- ✅ 验证大规模工具集需要动态筛选（Tool Attention的ISO score）
- ⚠️ MCP大数据传输：VAKRA的get_data轻量预览模式值得借鉴
- ⚠️ 缺乏显式API+RAG混合查询能力

## Actionable Recommendations

1. **Gym场景分层**: 按C1-C4能力维度设计测试场景
2. **工具筛选机制**: 集成Tool Attention的ISO score进行动态工具过滤
3. **MCP优化**: 实现get_data模式的轻量预览+服务端存储
4. **多跳追踪**: 显式追踪推理链中的每一步状态

## Resources

- **Dataset**: https://huggingface.co/datasets/ibm-research/VAKRA
- **Leaderboard**: https://ibm-research-vakra.hf.space/
- **GitHub**: https://github.com/IBM/vakra
- **Release Blog**: https://www.ibm.com/new/announcements/introducing-vakra-benchmark

## Related
- [HB-260425-tool-attention-mcp-tax.md](HB-260425-tool-attention-mcp-tax.md) — MCP优化
- [HB-260425-ml-intern-test-time-compute.md](HB-260425-ml-intern-test-time-compute.md) — Test-time compute

## Tags
#benchmark #enterprise #ibm #vakra #tool-selection #multi-hop #evaluation
