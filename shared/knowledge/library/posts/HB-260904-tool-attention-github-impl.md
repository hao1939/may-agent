---
id: HB-260904
date: 2026-04-25
title: "Tool Attention GitHub实现解析: 参考实现验证95%Token削减"
source: GitHub (asadani/tool-attention)
url: https://github.com/asadani/tool-attention
stars: ★★★★★
tags: [mcp, tool-calling, implementation, lazy-loading, iso-score]
---

# Tool Attention GitHub实现解析

## 仓库概览

**Tool Attention**参考实现已开源，验证了论文中声称的95% token削减效果。

- **Repo**: `asadani/tool-attention`
- **架构**: 中间件层设计，可作为drop-in组件集成到现有Agent系统
- **代码结构**: 模块化实现，核心逻辑约几百行Python

## 核心组件实现

### 1. Vector Store (`vector_store.py`)
- **Backend**: FAISS-backed tool-summary索引
- **Encoder**: `sentence-transformers/all-MiniLM-L6-v2` (384维, ~90MB)
- **功能**: 工具摘要的向量化存储与检索

### 2. Intent Router (`intent_router.py`)
- **ISO Score计算**: 基于句嵌入的意图-工具对齐度评分
- **State-Aware Gating**: 执行状态感知的工具可用性控制
- **阈值**: 默认threshold=0.28, top_k=10

### 3. Lazy Loader (`lazy_loader.py`)
- **Two-Phase设计**:
  - Phase-1: 紧凑摘要池常驻内存 (787 tokens)
  - Phase-2: LRU缓存的完整schema按需加载 (4,672 tokens)
- **缓存策略**: 首轮后Phase-1可被prompt caching

### 4. Tool Attention中间件 (`tool_attention.py`)
- **Before/After模型钩子**: `before_model()` / `after_model()`
- **Token计数**: 使用tiktoken cl100k_base编码

## 实测性能数据

基于120工具合成目录，7个查询的benchmark结果：

| 方法 | Tokens/轮 | 削减率 |
|------|----------|--------|
| B1 朴素全Schema | 57,452 | 0.0% |
| B3 简单检索(top-k) | 5,390 | 90.6% |
| Tool Attention: 仅Phase-1 | 787 | **98.6%** |
| Tool Attention: 仅Phase-2 | 4,672 | **91.9%** |
| Tool Attention: 首轮(P1+P2) | 5,459 | 90.5% |

**关键发现**:
- 稳态成本由Phase-2主导（激活工具的完整schema）
- Phase-1在首轮后可被缓存，边际成本趋近于零

## 对OpenClaw的直接适用性

### ✅ 已验证兼容
- **Skill选择优化**: ISO评分机制可直接应用于Skill路由
- **延迟加载验证**: OpenClaw现有Skill系统已采用类似设计
- **中间件架构**: before_model/after_model钩子与Wing系统架构匹配

### ⚠️ 需适配点
- **MCP遥测**: 需Instrument MCP开销，监控70%上下文阈值
- **阈值调优**: 0.28的ISO阈值需针对Skill领域校准
- **多服务器场景**: 企业级100+工具部署需测试扩展性

## 代码使用示例

```python
from vector_store import ToolVectorStore
from intent_router import IntentRouter
from lazy_loader import LazySchemaLoader
from tool_attention import ToolAttention

# 初始化
encoder = SentenceTransformer("sentence-transformers/all-MiniLM-L6-v2")
store = ToolVectorStore(dim=384)
store.add_tools(tools, encoder)

loader = LazySchemaLoader(registry_path=Path("catalog/schemas"))
router = IntentRouter(store=store, encoder=encoder, threshold=0.28, top_k=10)
ta = ToolAttention(store, loader, router, token_counter=count)

# 每轮调用
result = ta.before_model("list open PRs labeled bug")
print(result.active_ids)        # 路由选中的工具
print(result.phase1_tokens, result.phase2_tokens)  # token消耗
```

## 战略价值

1. **协议效率是绑定约束**: 95%削减验证MCP Tax可被系统性消除
2. **实现复杂度低**: 核心逻辑简洁，集成成本低
3. **经济影响大**: 多服务器企业场景下，token成本从10k-60k/轮降至2-5k/轮

## 相关链接

- [HB-260901](library/posts/HB-260901-tool-attention-mcp-optimization.md) - 论文解读
- [HB-260718](library/posts/HB-260718-tool-attention-deep-dive.md) - 深度分析
- [arXiv:2604.21816](https://arxiv.org/abs/2604.21816) - 原文
- [GitHub Repo](https://github.com/asadani/tool-attention) - 参考实现
