# HB-260430: Tool Attention — 消除MCP Tools Tax的中间件方案

> 来源: 小红书 @AI有意思 → arXiv 2604.21816 + github.com/asadani/tool-attention
> 日期: 2026-04-30
> 类型: 论文 + 开源代码

## 核心问题：MCP Tools Tax

MCP协议每轮对话都把所有工具的JSON Schema全部注入上下文。量化数据：
- 4-6个Server → 每轮15k-55k token仅工具定义
- 120个工具×30轮 → 1.42M token纯开销
- 同一任务：CLI $3.2 vs MCP $55.2（17倍成本差）
- 上下文利用率超70%时推理质量断崖下降（幻觉、工具混淆）

## 解决方案：Tool Attention（三层机制）

### 1. ISO语义匹配
用sentence-transformers为每个工具生成384维embedding，每轮只选语义最相关的工具。毫秒级。

### 2. 状态门控
在语义匹配之上叠加确定性前置条件检查（认证状态、流程步骤等）。同时缩小Tool Poisoning攻击面。

### 3. 两阶段懒加载
- Phase 1: 所有工具只保留精简摘要（~40 token/工具）
- Phase 2: 模型选定工具后才加载完整Schema
- Prompt Cache命中率：22% → 84%

## 量化结果（模拟120工具环境）
- 每轮工具token：47.3k → 2.4k（-95%）
- 上下文利用率：24% → 91%（+3.8x）
- 幻觉防护门：触发率2.3%，78%情况模型自行修正

⚠️ **注意**：端到端结果（成功率、延迟、成本）是基于token测量+公开遥测数据的**投影值**，非实际LLM agent测量。论文已明确标注。

## 与MCP-Zero(HB-260429)的关系
MCP-Zero侧重主动工具发现+分层检索。Tool Attention侧重中间件层面的门控+懒加载。
两者方向一致：**按需加载、语义匹配、缩减常驻上下文**。Tool Attention更强调安全门控和缓存利用。

## 对我们系统的意义

**直接相关**：我们的agent系统已经在用类CLI的工具调用模式，天然避免了最严重的Tools Tax。但随着工具数量增长，同样的问题会出现在我们的tool定义注入中。

**可行动项**：
1. **工具摘要池**：给每个工具写40-token精简描述，只在需要时加载完整定义 — 这个现在就能做
2. **语义路由**：当工具>20个时，考虑用embedding做工具预筛选
3. **幻觉防护门**：agent调用未加载工具时拒绝执行 — 简单且高价值

## 链接
- 论文: https://arxiv.org/abs/2604.21816
- 代码: https://github.com/asadani/tool-attention
- 许可: CC BY 4.0
