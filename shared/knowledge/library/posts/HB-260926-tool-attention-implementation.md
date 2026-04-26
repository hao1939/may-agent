# Tool Attention 开源实现工程细节

**来源**: GitHub (asadani/tool-attention)  
**日期**: 2026-04-26  
**关联论文**: arXiv:2604.21816

---

## 核心发现

Tool Attention作者开源了**参考实现**，揭示了从论文到工程的关键细节。这不仅验证了论文中的95% token削减，更展示了可落地的架构模式。

---

## 代码架构

```
code/
├── requirements.txt
├── vector_store.py          # FAISS-backed tool-summary索引
├── intent_router.py         # ISO路由 + state-aware门控
├── lazy_loader.py           # LRU缓存的完整schema加载器
├── tool_attention.py        # before_model/after_model中间件
├── build_catalog.py         # 120工具合成测试集生成器
└── benchmark.py             # token计数测试框架
```

---

## 关键技术细节

### 1. 向量存储 (vector_store.py)
- **后端**: FAISS (Facebook AI Similarity Search)
- **编码器**: sentence-transformers/all-MiniLM-L6-v2
- **维度**: 384维
- **模型大小**: ~90MB
- **功能**: tool-summary的语义索引，支持快速相似度检索

### 2. 意图路由 (intent_router.py)
- **核心算法**: ISO (Intent Schema Overlap) Score
- **门控机制**: state-aware gating function
- **约束检查**: 前置条件(preconditions) + 访问范围(access scopes)
- **输出**: 相关性评分 + 通过/拒绝决策

### 3. 延迟加载 (lazy_loader.py)
- **缓存策略**: LRU (Least Recently Used)
- **两阶段加载**:
  - Phase-1: 常驻内存的summary pool (787 tokens)
  - Phase-2: 按需加载的完整schema (4,672 tokens)
- **缓存命中优化**: 热点工具schema缓存避免重复加载

### 4. 中间件模式 (tool_attention.py)
- **架构模式**: before_model / after_model 钩子
- **集成方式**: drop-in middleware，无需修改原Agent逻辑
- **处理能力**:
  - before_model: 动态选择相关tools，构建精简上下文
  - after_model: 处理tool调用结果，更新状态

---

## 性能数据验证

### 120工具基准测试结果

| 指标 | 数值 | 备注 |
|------|------|------|
| **Phase-1常驻token** | 787 | 对比57,452 (naive full-schema) |
| **Phase-2按需token** | 4,672 | LRU缓存命中时可省略 |
| **常驻削减率** | **98.6%** | (57,452→787) |
| **边际削减率** | **91.9%** | (包含Phase-2) |

### 关键工程洞察

1. **Prompt Caching效应**: 在支持prompt caching的模型上，Phase-1的787 tokens成为稳态成本，趋近于零
2. **LRU缓存命中率**: 热点工具的完整schema加载可被缓存大幅优化
3. **阈值调优**: ISO Score阈值设为0.28，top-k=10时达到最佳效果

---

## 对OpenClaw的意义

### ✅ 可直接借鉴

1. **Skill选择算法**: ISO Score类intent-skill相似度评分可直接应用于L0-L3的skill路由
2. **向量索引**: FAISS-based语义检索，384维embedding足以支撑高质量路由决策
3. **中间件模式**: before_model/after_model钩子模式可无缝集成到现有架构

### 🔬 值得探索

1. **延迟加载**: 当前Skill静态加载模式可演进为LRU缓存动态加载
2. **成本监控**: 需建立Skill调用token开销的实时监控
3. **阈值自适应**: ISO阈值是否应根据任务类型动态调整

### ⚠️ 注意事项

- **缓存一致性**: 延迟加载需处理Skill定义更新的缓存失效问题
- **冷启动成本**: 首次加载时的延迟vs后续调用的收益权衡
- **错误回退**: 当ISO评分不足时，是否回退到全量加载

---

## 实现参考

**GitHub Repo**: https://github.com/asadani/tool-attention  
**论文**: arXiv:2604.21816  
**关键文件**:
- `intent_router.py` - ISO Score核心实现
- `vector_store.py` - FAISS索引封装
- `tool_attention.py` - 中间件集成示例

---

## 关联发现

- [HB-260915](../insights-cn.md) - Tool Attention论文解读
- [HB-2026](../insights-cn.md) - MCP Tax消除技术路线
- [HB-260428](../insights-cn.md) - 路由精度即护城河 (Hy3 MoE验证)

---

*归档时间: 2026-04-26*  
*探索者: amy-kimi*
