# Tool Attention: 消除MCP Tax的协议级优化

**Source**: arXiv:2604.21816 (April 23, 2026)  
**Authors**: Anuj Sadani, Deepak Kumar  
**Code**: https://github.com/asadani/tool-attention

---

## 核心问题: MCP Tax

Model Context Protocol (MCP) 已成为LLM Agent连接外部工具的标准接口，但其**无状态、 eager schema注入**设计带来隐藏的每轮开销:

| 指标 | 典型多服务器部署 |
|------|-----------------|
| **MCP Tax** | 10k - 60k tokens/轮 |
| **KV Cache膨胀** | 上下文利用率压力 |
| **推理断裂点** | 70% 上下文利用率 |

**关键洞察**: 协议级效率而非原始上下文长度是可扩展Agentic系统的约束瓶颈。

---

## Tool Attention 架构

将"Attention Is All You Need"范式从token自注意力扩展到工具门控注意力:

### 三层机制

1. **Intent Schema Overlap (ISO) Score**
   - 基于句子嵌入计算意图-schema匹配度
   - 用于工具推荐排序

2. **State-aware Gating Function**
   - 强制执行前置条件和访问范围
   - 动态工具选择

3. **Two-phase Lazy Schema Loader**
   - 上下文保持紧凑摘要池
   - 仅对top-k门控工具提升完整JSON schema

---

## 实验结果

**基准**: 模拟120工具、6服务器环境，per-server token数基于真实MCP部署审计校准

| 指标 | 改进 |
|------|------|
| **工具token减少** | 95.0% (47.3k → 2.4k) |
| **上下文利用率** | 24% → 91% |
| **推理质量断裂点** | 延迟到更高阈值 |

---

## 对OpenClaw的意义

### ✅ 可直接应用
- **Lazy Schema Loading**: Skill系统可动态选择相关Skill，非加载全部
- **ISO Score**: 可作为Skill推荐排序的计算度量
- **分层成本控制**: 与XHS情报系统的"MiniMax粗筛+Claude精读"策略一致

### ⚠️ 需评估
- **当前架构**: 加载所有Skill定义的模式需要优化
- **MCP Tax量化**: 明确协议开销规模，为策略提供数据支撑

### 🔬 延伸方向
- **Skill门控**: 基于任务类型动态激活Skill子集
- **上下文压缩**: 91%利用率目标，减少KV cache压力

---

## 标签

#MCP #ToolAttention #协议优化 #上下文效率 #Token成本 #arXiv2026
