# Tool Attention GitHub实现详情

**来源**: GitHub (asadani/tool-attention) | arXiv:2604.21816 companion code  
**发现日期**: 2026-04-26  
**相关**: [HB-2026-tool-attention-mcp-tax.md](HB-2026-tool-attention-mcp-tax.md)

---

## 核心发现

Tool Attention论文作者开源了**参考实现**， revealing关键工程细节：

### 实测性能数据（120工具基准）

| 方法 | tokens/turn | reduction |
|------|-------------|-----------|
| B1 Naive Full-Schema | 57,452 | 0.0% |
| B3 Simple Retrieval (top-k) | 5,390 | 90.6% |
| **Tool Attention: Phase-1 only** | **787** | **98.6%** |
| **Tool Attention: Phase-2 only** | **4,672** | **91.9%** |
| Tool Attention: first turn (P1+P2) | 5,459 | 90.5% |

**关键洞察**: Phase-1 (summary pool) 仅需787 tokens，在prompt caching下稳态成本几乎为零。

### 架构实现

```
code/
├── vector_store.py      # FAISS-backed tool-summary index
├── intent_router.py     # ISO router + state-aware gate
├── lazy_loader.py       # LRU-cached full-schema loader
├── tool_attention.py    # before_model / after_model middleware
├── build_catalog.py     # 120-tool synthetic testbed生成器
└── benchmark.py         # token-counting harness
```

### 关键技术细节

**1. ISO Score计算**
- 使用 `sentence-transformers/all-MiniLM-L6-v2` (384维, ~90MB)
- 阈值: 0.28
- Top-k: 10

**2. 两阶段延迟加载**
- **Phase-1**: Summary pool常驻上下文 (787 tokens)
- **Phase-2**: LRU缓存的完整schema按需加载 (4,672 tokens)
- 在prompt caching下，稳态每轮成本仅Phase-2

**3. 中间件集成模式**
```python
# Per-turn middleware call
result = ta.before_model("list open PRs labeled `bug` in the auth repo")
print(result.active_ids)        # 本回合路由的工具
print(result.phase1_tokens, result.phase2_tokens)
```

### 与OpenClaw的关联

| Tool Attention组件 | OpenClaw对应模块 | 应用建议 |
|-------------------|-----------------|----------|
| ISO Score | Skill选择算法 | 引入intent-skill相似度评分 |
| FAISS vector store | Skill索引 | 构建语义化Skill检索 |
| State-aware gating | Skill权限系统 | 前置条件检查+访问控制 |
| LRU lazy loader | Skill加载器 | 延迟加载完整Skill定义 |
| before_model/after_model | Skill调用Hook | 注入效率监控 |

### 关键代码片段

**Minimal usage pattern**:
```python
from vector_store import ToolVectorStore
from intent_router import IntentRouter
from lazy_loader import LazySchemaLoader
from tool_attention import ToolAttention

encoder = SentenceTransformer("sentence-transformers/all-MiniLM-L6-v2")

store = ToolVectorStore(dim=384)
store.add_tools(tools, encoder)

loader = LazySchemaLoader(registry_path=Path("catalog/schemas"))
router = IntentRouter(store=store, encoder=encoder, threshold=0.28, top_k=10)
ta = ToolAttention(store, loader, router, token_counter=count)
```

### 工程启示

1. **阈值调优**: 0.28的ISO阈值是在精度和召回之间的平衡
2. **向量维度**: 384维MiniLM足以支撑工具路由，无需大模型
3. **缓存策略**: LRU缓存对重复使用的工具schema至关重要
4. **Token计数**: 使用tiktoken cl100k_base进行精确预算

---

## 对OpenClaw的意义

✅ **立即可用**: Skill系统可借鉴的drop-in中间件模式  
🔬 **算法验证**: FAISS+MiniLM的384维嵌入足以支撑高质量Skill选择  
💡 **成本优化**: 98.6%的token减少意味着Skill-heavy场景的成本重构  
⚠️ **架构适配**: 需评估与当前Skill静态加载模式的兼容性

---

## 参考链接

- GitHub: https://github.com/asadani/tool-attention
- arXiv: https://arxiv.org/abs/2604.21816
- 依赖: FAISS, sentence-transformers, tiktoken
