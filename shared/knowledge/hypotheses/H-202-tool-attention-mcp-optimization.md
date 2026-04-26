# H-202: Intent-Based Tool Gating消除MCP Tax

**状态**: active  
**来源**: arXiv:2604.21816 (Tool Attention Is All You Need)  
**发现日期**: 2026-04-26  
**发现者**: amy-kimi  
**相关**: HB-260945, HB-260826

---

## 假设陈述

OpenClaw当前将所有MCP工具schema全量注入每个session，导致每轮10k-60k token的"MCP Tax"。通过实现**Intent-Based Tool Gating**（基于意图的工具门控），可以：

1. **削减95%工具token开销**（从47.3k降至2.4k）
2. **提升上下文利用率**（从24%提升至91%）
3. **消除70%上下文断裂风险**

---

## 关键证据

### Tool Attention论文数据
- **基准**: 120工具、6服务器模拟
- **改进**: 每轮token 47,452 → 2,400（95.8%削减）
- **上下文利用率**: 24% → 91%
- **关键机制**: ISO Score + 状态感知门控 + 两阶段懒加载

### OpenClaw当前状态（待验证）
- [ ] 统计当前所有MCP工具的schema token数
- [ ] 测量典型session的工具相关token占比
- [ ] 识别接近70%上下文断裂点的session

---

## 机制设计

### Phase 1: Intent Schema Overlap (ISO) Score
```
Input:  User Intent (embedding)
        Tool Schema Summary (embedding)
Output: Similarity Score [0-1]

Top-k tools with score > threshold 进入下一阶段
```

### Phase 2: State-Aware Gating
```
Input:  Current Session State
        Top-k Candidate Tools
Output: Gated Tool Set (满足preconditions和access scopes)
```

### Phase 3: Lazy Schema Loading
```
Context保留: Tool Summary Pool (紧凑格式)
On-demand:   Full JSON Schema仅对gated tools加载
```

---

## 实施路径

### 🔴 紧急（4周内）
1. **测量**: 统计当前MCP工具token开销
2. **摘要设计**: 为每个SKILL.md添加compact summary格式
3. **原型**: 实现基于关键词的简单门控（快速验证）

### 🟡 中期（8周内）
4. **语义匹配**: 集成sentence embedding计算ISO score
5. **状态集成**: 与AGENTS.md preconditions系统结合
6. **懒加载**: 实现两阶段schema加载

### 🟢 长期（12周内）
7. **动态适应**: 基于session历史优化门控策略
8. **全局优化**: 跨session工具使用模式分析

---

## 验证标准

| 指标 | 当前(估计) | 目标 | 验证方法 |
|-----|-----------|------|---------|
| 每轮工具token | ? | -95% | Session日志分析 |
| 上下文利用率 | ? | >90% | Token统计 |
| 工具调用延迟 | ? | <+10% | 端到端测试 |
| 任务成功率 | ? | 不下降 | Gym评估 |

---

## 风险与缓解

| 风险 | 影响 | 缓解措施 |
|-----|------|---------|
| 门控漏掉关键工具 | 高 | 保守阈值 + fallback机制 |
| Embedding计算延迟 | 中 | 缓存 + 近似最近邻 |
| 状态同步复杂性 | 中 | 与现有preconditions系统集成 |
| 工具依赖关系 | 中 | 依赖图分析 + 级联加载 |

---

## 与现有系统的关联

- **AGENTS.md**: Preconditions系统可作为state-aware gating基础
- **SKILL.md**: Compact summary格式需要扩展标准
- **L0 Planning**: Intent提取结果直接驱动ISO score计算
- **Session管理**: 工具加载状态需要持久化

---

## 相关文献

1. Sadani & Kumar. "Tool Attention Is All You Need." arXiv:2604.21816, 2026.
2. 相关发现: HB-260945, HB-260826 (Tool Attention动态门控)

---

**标签**: #mcp-optimization #tool-gating #context-efficiency #token-reduction #high-priority
