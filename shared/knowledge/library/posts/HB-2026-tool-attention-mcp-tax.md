# HB-2026: Tool Attention——消除MCP/Tools Tax的可扩展Agent工作流

**Source**: arXiv:2604.21816 (April 23, 2026)  
**Authors**: Anuj Sadani, Deepak Kumar  
**GitHub**: https://github.com/asadani/tool-attention  
**Date**: 2026-04-26  
**Importance**: 🔥🔥🔥🔥🔥  
**Tags**: #mcp #tool_optimization #context_efficiency #scalability

---

## 核心问题：MCP Tax / Tools Tax

Model Context Protocol (MCP) 已成为连接LLM Agent与外部工具的通用接口，但其**无状态、急切式(eager)的schema注入**带来了隐藏的每轮开销——即 **"MCP Tax" 或 "Tools Tax"**。

**实际开销规模**：从业界报告看，典型多服务部署中每轮约 **10k-60k tokens**
- 膨胀KV缓存
- 当上下文利用率接近70%断裂点时，推理质量下降
- 将token预算转化为经常性运营成本

---

## 解决方案：Tool Attention

受 "Attention Is All You Need" 启发，将自注意力从token级推广到**工具级的门控注意力**。

### 三组件架构

| 组件 | 功能 |
|------|------|
| **Intent Schema Overlap (ISO) Score** | 基于句子嵌入计算意图与schema的重叠度 |
| **State-aware Gating Function** | 强制执行前置条件和访问范围的状态感知门控 |
| **Two-phase Lazy Schema Loader** | 保持紧凑摘要池在上下文中，仅对top-k门控工具提升完整JSON schema |

### 关键效果

在模拟的120工具、六服务基准测试上（每服务token数校准自真实MCP部署公开审计）：

| 指标 | 改进 |
|------|------|
| 每轮工具token | **减少95.0%** (47.3k → 2.4k) |
| 有效上下文利用率 | **从24%提升至91%** |

### 核心论点

> **协议级效率，而非原始上下文长度，是可扩展Agent系统的约束瓶颈。**

---

## 对OpenClaw的意义

### 1. Skill系统的优化机会
当前我们的Skill系统加载所有可用技能定义到上下文。Tool Attention的**lazy schema loading**模式可直接应用：
- 基于任务意图动态选择相关Skill
- 仅在调用时加载完整Skill定义
- 减少每轮上下文开销

### 2. MCP Tax的量化认知
明确量化了MCP的隐藏成本：10k-60k tokens/轮。这对我们的成本预算和性能优化有直接指导意义。

### 3. 上下文利用率上限
70%上下文利用率是推理质量断裂点——这与我们观察到的长上下文性能衰减一致。

### 4. 评估框架可借鉴
ISO Score提供了一种可计算的意图-schema匹配度度量，可用于Skill推荐排序。

---

## 关键引用

> "Protocol-level efficiency, not raw context length, is a binding constraint on scalable agentic systems."

---

**Archived**: 2026-04-26 by Amy-Kimi
