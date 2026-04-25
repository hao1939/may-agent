# Tool Attention Is All You Need: 消除 MCP/Tools 税

**来源**: arXiv cs.AI (Apr 23, 2026) — arXiv:2604.21816  
**作者**: Anuj Sadani, Deepak Kumar  
**代码**: https://github.com/asadani/tool-attention  
**状态**: 已开源

---

## 核心问题

**MCP Tax (Tools Tax)**: Model Context Protocol 的状态化、急切 schema 注入导致每轮 **10k-60k token** 隐藏开销：

- KV 缓存膨胀
- 上下文利用率达到 70% 时出现推理断裂
- token 预算变成反复出现的运营成本

> "协议级效率，而非原始上下文长度，是可扩展 Agent 系统的约束条件。"

---

## 解决方案: Tool Attention

将 "Attention Is All You Need" 范式从 **token 级自注意力** 泛化到 **工具级门控注意力**。

### 三组件架构

#### 1. Intent Schema Overlap (ISO) Score
- 使用**句子嵌入**计算用户意图与工具 schema 的语义匹配
- 为每个工具计算相关性分数

#### 2. 状态感知门控 (State-aware Gating)
- 强制执行工具前置条件和访问范围
- 根据当前状态过滤不可用工具

#### 3. 两阶段懒加载器 (Two-phase Lazy Loader)
- **上下文保持**: 紧凑的工具摘要池（非完整 schema）
- **按需加载**: 仅对 top-k 门控工具加载完整 JSON schema

---

## 关键数据

在模拟的 **120 工具、6 服务器** 基准测试上（基于真实 MCP 部署数据校准）：

| 指标 | 改进前 | 改进后 | 提升 |
|------|--------|--------|------|
| 每轮工具 token | 47.3k | 2.4k | **-95.0%** |
| 上下文利用率 | 24% | 91% | **+67 点** |

---

## 核心洞察

> "Protocol-level efficiency, not raw context length, is a binding constraint on scalable agentic systems."
> — 协议级效率，而非原始上下文长度，是可扩展 Agent 系统的绑定约束

**关键阈值**:
- 70% 上下文利用率：推理质量开始下降的断裂点
- 工具 token 占比：在多服务器部署中占主导地位

---

## 对 OpenClaw 的意义

### ✅ 可直接集成
1. **Skill 系统已使用懒加载**: 基础架构兼容
2. **ISO 评分可优化 Skill 选择**: 基于意图的动态技能排序
3. **验证 XHS 社区担忧**: MCP 吃掉 90% 上下文的担忧得到学术验证

### ⚠️ 待实现能力
1. **意图感知的动态工具过滤**: 当前缺乏基于 query 意图的 Skill 预选
2. **上下文利用率监控**: 需要跟踪实际上下文使用情况
3. **工具 schema 压缩**: 需要紧凑的 Skill 描述格式

### 📊 架构建议
```
用户 Query 
  → ISO 评分 (意图匹配)
  → 状态门控 (可用性过滤) 
  → Top-k Skill 选择
  → 懒加载完整 Skill 定义
  → 执行
```

---

## 实现细节

**参考代码**: https://github.com/asadani/tool-attention

**适用场景**:
- 多服务器 MCP 部署
- 100+ 工具的企业环境
- 长对话会话（上下文累积）

---

## 相关资源

- **MCP 官方**: https://modelcontextprotocol.io/
- **论文**: arXiv:2604.21816
- **代码**: https://github.com/asadani/tool-attention

---

*标签: #mcp #tool-attention #context-efficiency #lazy-loading #iso-score #token-optimization*