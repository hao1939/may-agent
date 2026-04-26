# Tool Attention: 95% MCP Tax消除工程方案

**ID**: HB-260937  
**日期**: 2026-04-26  
**来源**: arXiv:2604.21816 | GitHub: asadani/tool-attention  
**标签**: #mcp #tool-attention #token-efficiency #agent-architecture

---

## 核心发现

**Tool Attention**是一个中间件层机制，通过动态工具门控+懒加载，将MCP协议每轮token消耗从47.3k降至2.4k（**95%削减**），上下文利用率从24%提升至91%。

### MCP Tax问题量化

| 指标 | 典型值 | 影响 |
|------|--------|------|
| 每轮工具token | 10k-60k | 关键值缓存膨胀 |
| 上下文断裂点 | ~70% | 推理能力下降 |
| 操作成本 | 经常性 | token预算持续消耗 |

### Tool Attention技术架构

```
Intent Schema Overlap (ISO) Score
    ↓ (句子嵌入相似度)
State-Aware Gating Function  
    ↓ (前置条件+访问范围检查)
Two-Phase Lazy Schema Loader
    ├── Phase-1: 紧凑摘要池 (常驻上下文)
    └── Phase-2: 完整JSON Schema (按需加载)
```

**核心组件**:
1. **ISO Score**: 基于句子嵌入的意图-工具相关性评分 (MiniLM 384维)
2. **状态感知门控**: 强制执行前置条件和访问范围约束
3. **两阶段懒加载**: 摘要池常驻 + Top-K工具完整schema按需加载

### 性能数据

| 指标 | 基准 | Tool Attention | 改进 |
|------|------|----------------|------|
| 每轮工具token | 47.3k | 2.4k | **-95%** |
| 上下文利用率 | 24% | 91% | **+67pp** |
| 模拟工具数 | 120 | 120 | 6服务器 |

### 关键洞察

> "协议级效率，而非原始上下文长度，是可扩展Agentic系统的约束瓶颈。"

这意味着：
- 增加模型上下文窗口不如优化协议效率
- MCP Tax是架构级问题，非实现细节
- 工具路由质量决定系统可扩展性

---

## 对OpenClaw的意义

### ✅ CLI优先策略验证

Tool Attention为远程工具集成提供了除MCP外的第三选择，但本地CLI仍保持零开销优势。三层架构更加清晰：

| 层级 | 技术 | 开销 | 适用场景 |
|------|------|------|----------|
| 本地 | CLI | **零开销** | 本地开发工具 |
| 远程优化 | Tool Attention | 2.4k token/轮 | 已知工具集 |
| 远程标准 | MCP | 47.3k+ token/轮 | 复杂动态工具 |

### 🔬 SKILL.md升级路径

当前SKILL.md可作为"摘要池"基础：
- 意图-技能相似度路由 (ISO Score机制)
- 技能元数据前置声明触发条件
- 详细技能内容延迟加载

### 🔬 成本监控指标

应建立追踪指标：
- `tool_tax_per_turn`: 每轮工具相关token
- `context_utilization`: 有效上下文利用率
- `skill_retrieval_efficiency`: 技能检索精准度

---

## 相关资源

- **论文**: arXiv:2604.21816 (21 pages)
- **代码**: https://github.com/asadani/tool-attention
- **相关发现**: [HB-260936-microsoft-playwright-mcp](HB-260936-microsoft-playwright-mcp.md)

---

## session_notes
- 已写入insights-cn.md和research-digest.md
- 需要监控：技能系统是否应实现ISO Score类路由机制
