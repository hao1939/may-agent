# HB-260429: MCP-Zero — 主动工具发现，降低98% Token开销

- **来源**: 小红书 @Ryan聊大模型 (142赞, 246收藏)
- **日期**: 2025-07-07
- **链接**: https://www.xiaohongshu.com/explore/686bd351000000001203f9bf
- **论文**: "MCP-Zero: Proactive Toolchain Construction for LLM Agents from Scratch"

## 核心机制

解决MCP工具规模爆炸（千→百万级）时的两大瓶颈：上下文臃肿 + 多步检索失效。

**三重创新**：
1. **主动需求表达** — LLM自主生成结构化工具请求（`server: filesystem, tool: read_file`），而非被动接收全量工具列表
2. **两阶段分层检索** — 先锁定server，再匹配tool，粗到细
3. **可迭代调用链** — "请求-检索-执行-反馈"循环，工具不匹配可重试

**实验结果**：Token降低98%，多轮任务准确率>90%，3000工具规模验证。

## 对我们系统的意义

我们当前是把所有工具直接塞进Agent的system prompt。工具数量少时没问题，但如果工具增长到几十个，就该考虑MCP-Zero的按需加载思路：

- Agent声明"我需要什么能力"，由中间层匹配工具
- 这与我们的Agent-tool架构天然契合：每个Agent不需要知道所有工具，只需要描述意图
