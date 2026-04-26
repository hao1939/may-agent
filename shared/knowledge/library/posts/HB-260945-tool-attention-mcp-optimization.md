# HB-260945: Tool Attention — 消除MCP工具税的动态门控机制

**Source**: arXiv:2604.21816  
**Title**: Tool Attention Is All You Need: Dynamic Tool Gating and Lazy Schema Loading for Eliminating the MCP/Tools Tax in Scalable Agentic Workflows  
**Authors**: Anuj Sadani, Deepak Kumar  
**Date**: 2026-04-23  
**Code**: https://github.com/asadani/tool-attention

---

## 核心问题

MCP (Model Context Protocol) 虽然已成为LLM Agent连接外部工具的标准接口，但其**有状态、急切的schema注入**机制带来隐性开销：

- **MCP Tax / Tools Tax**: 每轮对话10k-60k token（典型多服务器部署）
- 膨胀KV缓存，导致上下文利用率接近70%断裂点时推理质量下降
- Token预算变成持续运营成本

---

## 解决方案: Tool Attention

将"Attention Is All You Need"从token自注意力推广到**工具门控注意力**，三组件：

### 1. Intent Schema Overlap (ISO) Score
- 基于sentence embedding计算意图与工具schema的语义重叠度
- 量化相关性，替代全量schema加载

### 2. State-Aware Gating Function
- 强制执行前置条件(preconditions)和访问范围(access scopes)
- 根据当前状态动态决定工具可用性

### 3. Two-Phase Lazy Schema Loader
- **Phase 1**: 保持紧凑摘要池(compact summary pool)在上下文中
- **Phase 2**: 仅对top-k门控工具提升完整JSON schema

---

## 实验结果

基于120工具、6服务器的模拟基准（token数校准自真实MCP部署审计）：

| 指标 | 改进 |
|------|------|
| 每轮工具token | **-95.0%** (47.3k → 2.4k) |
| 有效上下文利用率 | **24% → 91%** |
| 任务成功率 | 提升（投影值） |
| 延迟/成本 | 显著降低 |

**核心洞察**: 协议级效率（而非原始上下文长度）是可扩展Agentic系统的约束瓶颈。

---

## 对OpenClaw的意义

### 🔴 高优先级

1. **MCP工具管理优化**
   - 当前系统所有MCP工具schema一次性注入，随工具增长线性膨胀
   - Tool Attention的延迟加载机制可直接迁移

2. **Intent-Based工具路由**
   - 结合我们的Intent提取层，实现ISO score计算
   - 只加载与当前意图相关的工具子集

3. **上下文利用率监控**
   - 论文指出70%是上下文断裂点
   - 需要增加token利用率指标，接近阈值时触发优化

### 🟡 中等优先级

4. **工具摘要设计**
   - 为每个SKILL.md设计compact summary格式
   - 区别于完整schema，保留核心语义信息

5. **前置条件验证框架**
   - 论文中的state-aware gating可与AGENTS.md约束系统结合
   - 避免无效工具调用

---

## 相关链接

- Paper: https://arxiv.org/abs/2604.21816
- Code: https://github.com/asadani/tool-attention
- 同主题: HB-260826 (Tool Attention动态门控 - 小红书来源)

---

**标签**: #mcp #tool-optimization #context-efficiency #agent-architecture #scalability
