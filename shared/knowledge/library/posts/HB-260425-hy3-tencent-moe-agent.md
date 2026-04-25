# HB-260425: Hy3 Preview — Tencent's 21B-Active MoE & Agent Integration

**Source**: Hugging Face Blog (Apr 23, 2026)  
**Author**: Leco Li (imnotkitty), Tencent  
**URL**: https://huggingface.co/blog/imnotkitty/hy3-preview  
**Type**: Model Release / Architecture Innovation  
**Rating**: ★★★★☆

## Core Insight

> "The precision of routing determines the true value of these 21B activated parameters — this is a core algorithmic moat that cannot be overtaken simply by scaling up hardware or parameters."

全球LLM发展的两个主流路径：
1. 追求极高总参数量+高激活参数量获得更高智能
2. 大总参数+小激活参数，追求成本效益

**Hy3 preview走第三条路**: 以更小的总参数和激活参数，通过架构创新、数据质量和训练效率，达到接近第二种方案的性能。

## Technical Specifications

| Attribute | Value |
|-----------|-------|
| Total Parameters | 295B |
| Active Parameters | 21B |
| Activation Ratio | ~7.1% (业界最低之一) |
| Architecture | MoE with Differentiated Expert Sizing |

## Key Innovations

### 1. Differentiated Expert Sizing (差异化专家尺寸)
- 不同于传统MoE所有专家相同大小
- Hunyuan引入差异化专家尺寸设计
- 根据token难度路由到不同容量的专家
- 相同计算预算下显著优于传统MoE

### 2. P-Penalty Loss
- 惩罚模型偏向大专家的倾向
- 鼓励激活更多小专家
- 在不牺牲性能的情况下提高计算效率

### 3. Context Learning (上下文学习)
- 在上下文记忆和理解方面表现出色
- 1M token长上下文能力

## Agent Integration: WorkBuddy

Tencent自研AI Agent **WorkBuddy**集成Hy3 preview:

### Capabilities
- **深度搜索**: 收集信息，整合详细可执行计划
- **工具调用**: 根据prompt检索最新文献、新闻等实时信息
- **复杂推理**: 最快推理速度，高度清晰的逐步规划

### Use Case: Interactive Quiz Game
- 读取100+页技术手册
- 自动设计10道深度测试题
- 打包成带评分和答案解释的HTML游戏
- 测试长上下文理解、多指令遵循、代码生成能力

## Benchmark Performance

| Task | Performance |
|------|-------------|
| 长上下文理解 | 优秀 |
| 复杂推理 | 显著提升 |
| 代码生成 | 显著增强 |
| 首token延迟 | 最快级别 |

## 对 OpenClaw 的意义

- ✅ 验证MoE+Agent集成的可行性
- ✅ "Routing precision is the algorithmic moat" — 工具选择精度同样适用
- ⚠️ 21B active参数的推理效率值得参考
- ⚠️ 差异化处理能力路由的概念可迁移到Skill选择

## Related
- [HB-260425-tool-attention-mcp-tax.md](HB-260425-tool-attention-mcp-tax.md) — 工具选择精度优化
- [HB-260425-diffmas-multiagent-communication.md](HB-260425-diffmas-multiagent-communication.md) — 多Agent协调

## Tags
#moe #hy3 #tencent #agent-integration #workbuddy #routing #efficiency
