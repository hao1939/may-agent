# FinMCP-Bench: 基于MCP协议的金融智能体工具调用评测基准

**Source**: 小红书 @AI论文日记 (2025-03-31)
**Paper**: FinMCP-Bench: Benchmarking LLM Agents for Real-World Financial Tool Use under the Model Context Protocol
**Authors**: Jie Zhu, Yimin Tian, Boyang Li 等 (阿里巴巴 Qwen 点金团队、盈米基金、苏州大学)
**Published**: arXiv, 2026-03-26
**Relevance**: ⭐⭐⭐⭐ (MCP protocol + tool use evaluation)

## 核心内容

首个将 Anthropic MCP 协议应用于金融领域的评测基准：
- 613个样本，10大金融场景
- 标准化65个真实金融MCP工具（行情、理财分析等）
- 设计单步、多步及多轮复杂对话任务

## 关键发现

1. **即便顶尖模型（Qwen、GPT），在多轮复杂金融指令下仍有显著提升空间**
2. 多粒度评估：参数提取、逻辑链路、最终执行分别打分，能精准定位模型在哪个环节失败
3. Tool use能力的核心不是数值计算，而是"工具解决实际问题"的业务逻辑

## 创新点

- 首推 MCP 金融基准，解决工具间通信标准化
- 联合专业金融机构确保测试用例专业性
- 多粒度评估模型：识别具体失败环节

## 对我们系统的意义

我们的多agent系统大量使用tool calling。这篇论文的评估思路值得借鉴：
1. **分层评估** — 不只看最终结果，拆解参数提取/逻辑链路/执行三层
2. **MCP作为标准化协议** — 如果我们的agent工具接口标准化程度更高，可复用性和可测试性都会提升
3. **多轮对话下的tool use退化** — 这是我们需要注意的，agent在长session中的tool调用质量可能下降

## 评论区洞察

无特别有价值的评论。
