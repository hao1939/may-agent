# XHS Post Archive: WildToolBench - 腾讯混元ICLR 2026

**Post ID**: 69b62426000000001b023227  
**Author**: AIGCHUB  
**Date**: 2026-03-15 (19分钟前 北京)  
**Tags**: #AI智能体  
**Source**: XHS Feed

---

## Title
混元ICLR：揭秘Agent能力短板WildToolBench

## Core Content

腾讯混元 ICLR 2026 发布 WildToolBench，给全球 57 个主流大模型来了场"荒野生存大考验"。

### 惨烈战绩: Session 成功率竟不到 15%!

强如 Gemini 2.0 Thinking 和 Claude 4 Sonnet，在面对真实、复杂的用户行为时，Session (整个对话序列) 的成功率全部低于 15%。

**含义**: 一旦任务变长、变杂，AI 就会瞬间"掉链子"。

### 为什么 AI 变"笨"了？三个真凶

论文指出，真正难倒 AI 的不是工具多复杂，而是人类说话的"Wild":

1. **组合式任务 (Compositional Tasks)**
   - 人类不会只下一个指令
   - 例: "帮我搜几部热门电影，然后做个调研幻灯片"
   - 要求: AI 必须像指挥家一样编排工具，而不是死板地执行单一动作

2. **隐藏的意图 (Hidden Intention)**
   - 人类说话爱省略
   - 例: 上句"帮我查下上海天气"，下句"那北京呢？"
   - 挑战: AI 必须从多轮对话中精准推断意图，处理指代不明和长距离依赖

3. **指令的丝滑切换 (Instruction Transition)**
   - 聊天时经常"跳戏": 一会儿下达任务，一会儿求解释，一会儿闲聊
   - 要求: AI 必须能"秒切"策略，不被之前的上下文带偏

### 谁才是真正的"求生高手"?

| 梯队 | 模型 |
|------|------|
| 第一梯队 | Gemini 2.0, Claude 4 (推理能力是硬实力) |
| 国产之光 | GLM-4.5, Kimi-K2 (某些环节超越顶级闭源模型) |
| 推理模型 | o1, DeepSeek-R1 (复杂意图优势明显) |

### 核心 Insight

未来的智能体不能只当"工具搬运工"，而要学会"读心术"。

让 Agent 的评估从"实验室环境"走向"真实荒野"，这才是 AI 应用落地的关键一步！

---

## Paper Reference
- **Title**: Benchmarking LLM Tool-Use in the Wild
- **Conference**: ICLR 2026
- **Team**: 腾讯混元 (Hunyuan)
- **Scale**: 57个主流大模型测试

## Key Data Points
- Session 成功率: <15% (即使顶级模型)
- 核心挑战: 组合式任务、隐藏意图、指令切换
- 国产模型表现: GLM-4.5, Kimi-K2 亮眼

## Relevance to OpenClaw

1. **验证 Session 管理重要性**: OpenClaw 的 session-based 架构应对长链条任务
2. **意图推断挑战**: 与 HB#1333 "编制>模型"哲学呼应——需要结构化上下文
3. **工具编排 > 单工具执行**: 支持 OpenClaw Skill 组合设计
4. **真实场景评估**: WildToolBench 类型测试对 OpenClaw 有参考价值

---

**Archived**: 2026-03-15  
**HB Reference**: HB#1342 (补充 HB#1340 的社区解读)
