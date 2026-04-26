# Tool Attention: 95% MCP Tax 消除与动态工具门控

**来源**: arXiv:2604.21816 | GitHub: asadani/tool-attention  
**作者**: Anuj Sadani, Deepak Kumar  
**发现日期**: 2026-04-26  
**标签**: #mcp #tool-attention #token-efficiency #agent-infrastructure

---

## 核心发现

**MCP Tax 量化**: Model Context Protocol 存在隐藏的"工具税"——每轮对话10k-60k token的schema开销。Tool Attention 将其削减 **95%**（47.3k → 2.4k tokens）。

> "协议级效率，而非原始上下文长度，是可扩展Agentic系统的约束瓶颈"

---

## 技术机制

### 三层架构

1. **Intent Schema Overlap (ISO) Score**
   - 句子嵌入计算用户意图与工具schema的相关性
   - Encoder: `sentence-transformers/all-MiniLM-L6-v2` (384维, ~90MB)
   - 阈值: 0.28，Top-k: 10

2. **State-Aware Gating**
   - 动态检查前置条件和访问范围
   - 防止无效工具进入上下文

3. **Two-Phase Lazy Loading**
   - **Phase-1**: 常驻紧凑摘要池（787 tokens）
   - **Phase-2**: LRU缓存按需加载完整schema（4,672 tokens）
   - Prompt caching下稳态成本趋近零

### 性能数据

| 方法 | Tokens/轮 | 削减比例 | 上下文利用率 |
|------|-----------|----------|--------------|
| Naive Full-Schema | 57,452 | 0% | 24% |
| Simple Retrieval | 5,390 | 90.6% | - |
| **Tool Attention Phase-1** | **787** | **98.6%** | **91%** |
| Tool Attention Phase-2 | 4,672 | 91.9% | - |

---

## 关键洞察

### 70% 断裂点
- 上下文利用率超过70%时，推理质量显著下降
- Tool Attention将利用率从24%提升至91%，远离断裂点

### 成本结构转变
- **传统MCP**: 每轮固定支付10k-60k token税
- **Tool Attention**: 一次性摘要池成本 + 缓存命中时零边际成本

---

## 实现架构

```
tool-attention/
├── vector_store.py      # FAISS-backed tool-summary索引
├── intent_router.py     # ISO Score路由 + state-aware门控
├── lazy_loader.py       # LRU缓存的完整schema加载器
└── tool_attention.py    # before_model/after_model中间件
```

---

## 对OpenClaw的意义

### ✅ CLI策略验证
本地工具使用CLI完全避免MCP税，Tool Attention为远程集成提供第三选择。

### 🔬 SKILL.md潜力
技能元数据可作为"摘要池"的基础，实现Skill级别的延迟加载。

### 🔬 中间件模式
`before_model`/`after_model`钩子可注入效率监控，建立Token消耗实时追踪。

### 💡 混合架构
```
本地工具 → CLI (零开销)
远程工具 → Tool Attention (95%削减)
复杂编排 → MCP (标准化)
```

---

## 参考链接

- Paper: https://arxiv.org/abs/2604.21816
- Code: https://github.com/asadani/tool-attention
